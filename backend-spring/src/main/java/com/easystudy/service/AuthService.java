package com.easystudy.service;

import com.easystudy.dto.*;
import com.easystudy.exception.BusinessException;
import com.easystudy.model.Role;
import com.easystudy.model.User;
import com.easystudy.model.UserRole;
import com.easystudy.repository.RoleRepository;
import com.easystudy.repository.UserRepository;
import com.easystudy.repository.UserRoleRepository;
import com.easystudy.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final StringRedisTemplate redisTemplate;
    private final EmailService emailService;

    @Value("${jwt.expiration}")
    private long jwtExpirationSeconds;

    @Transactional
    public UserDto register(RegisterRequest request) {
        // 检查用户名是否已存在
        if (userRepository.existsByUsername(request.getUsername())) {
            throw BusinessException.usernameExists();
        }

        // 邮箱统一规范化后存储与比较。
        // 原实现注册时原样存、忘记密码/重置时先转小写再查，
        // 导致任何含大写字母的邮箱（如 Li.Ming@Example.com）在重置流程中
        // 被判为"未注册"，密码永远无法通过邮件找回。
        String email = normalizeEmail(request.getEmail());

        // 检查邮箱是否已存在
        if (email != null && userRepository.existsByEmail(email)) {
            throw new BusinessException(40001, "邮箱已被注册", HttpStatus.BAD_REQUEST);
        }

        // 查找角色 — 注册固定分配 ROLE_STUDENT，防止权限提升
        Role role = roleRepository.findByName("ROLE_STUDENT")
                .orElseThrow(() -> BusinessException.invalidRole());

        // 创建用户
        User user = User.builder()
                .username(request.getUsername())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .email(email)
                .displayName(request.getDisplayName())
                .isEnabled(true)
                .build();

        user = userRepository.save(user);

        // 分配角色
        UserRole userRole = UserRole.builder()
                .userId(user.getId())
                .roleId(role.getId())
                .build();
        userRoleRepository.save(userRole);

        log.info("User registered: id={}, username={}, role=ROLE_STUDENT", user.getId(), user.getUsername());

        return UserDto.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .role("ROLE_STUDENT")
                .build();
    }

    @Transactional(readOnly = true)
    public ApiResponse<AuthResponse> login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(BusinessException::invalidCredentials);

        if (!user.getIsEnabled()) {
            throw BusinessException.accountDisabled();
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw BusinessException.invalidCredentials();
        }

        List<String> roles = userRoleRepository.findRoleNamesByUserId(user.getId());

        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), roles);

        UserDto userDto = UserDto.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .email(user.getEmail())
                .avatarUrl(user.getAvatarUrl())
                .roles(roles)
                .build();

        AuthResponse authResponse = AuthResponse.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .expiresIn(jwtExpirationSeconds)
                .user(userDto)
                .build();

        return ApiResponse.ok("登录成功", authResponse);
    }

    @Transactional(readOnly = true)
    public UserDto getCurrentUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BusinessException.notFound("用户"));

        List<String> roles = userRoleRepository.findRoleNamesByUserId(user.getId());

        return UserDto.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .email(user.getEmail())
                .avatarUrl(user.getAvatarUrl())
                .roles(roles)
                .createdAt(user.getCreatedAt())
                .build();
    }

    // ── 忘记密码 ──

    private static final String RESET_CODE_PREFIX = "reset:code:";
    private static final long CODE_TTL_MINUTES = 5;
    private static final String RATE_LIMIT_PREFIX = "reset:ratelimit:";
    private static final long RATE_LIMIT_SECONDS = 60;
    /** 验证码最大尝试次数，超过即作废该验证码 */
    private static final String ATTEMPT_PREFIX = "reset:attempts:";
    private static final int MAX_CODE_ATTEMPTS = 5;
    /** 刷新时容忍的过期窗口（秒）：仅用于时钟偏移，不构成续期机制 */
    private static final long REFRESH_GRACE_SECONDS = 5 * 60;

    /**
     * 邮箱规范化：trim + 小写。
     * 全流程（注册/登录/忘记密码/重置）必须使用同一套规则，
     * 否则会出现"注册成功但无法找回密码"这类不一致。
     */
    private static String normalizeEmail(String email) {
        if (email == null) return null;
        String trimmed = email.trim();
        return trimmed.isEmpty() ? null : trimmed.toLowerCase(java.util.Locale.ROOT);
    }

    public void forgotPassword(ForgotPasswordRequest request) {
        String email = normalizeEmail(request.getEmail());
        if (email == null) {
            throw BusinessException.emailNotRegistered();
        }

        // 检查邮箱是否已注册
        if (!userRepository.existsByEmail(email)) {
            throw BusinessException.emailNotRegistered();
        }

        // 频率限制：同一邮箱 60 秒内只能请求一次。
        // 用 setIfAbsent 原子占位，替代原先"先 hasKey 再 set"的 TOCTOU 写法
        // （并发请求会同时通过检查并各发一封邮件）。
        String rateLimitKey = RATE_LIMIT_PREFIX + email;
        Boolean acquired = redisTemplate.opsForValue()
                .setIfAbsent(rateLimitKey, "1", Duration.ofSeconds(RATE_LIMIT_SECONDS));
        if (!Boolean.TRUE.equals(acquired)) {
            throw BusinessException.tooManyRequests();
        }

        // 生成 6 位验证码
        String code = emailService.generateCode();

        try {
            // 发送邮件；失败则回滚已写入的状态，避免"看起来失败却已被限流"
            emailService.sendVerificationCode(email, code);
        } catch (RuntimeException e) {
            redisTemplate.delete(rateLimitKey);
            throw e;
        }

        // 仅在发送成功后写入验证码与尝试计数
        String codeKey = RESET_CODE_PREFIX + email;
        redisTemplate.opsForValue().set(codeKey, code, Duration.ofMinutes(CODE_TTL_MINUTES));
        redisTemplate.delete(ATTEMPT_PREFIX + email);

        log.info("Password reset code sent to user (email 已脱敏, 长度={})", email.length());
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        String email = normalizeEmail(request.getEmail());
        String inputCode = request.getCode().trim();
        String newPassword = request.getNewPassword();

        if (email == null) {
            throw BusinessException.emailNotRegistered();
        }

        // 检查邮箱是否已注册
        User user = userRepository.findByEmail(email)
                .orElseThrow(BusinessException::emailNotRegistered);

        // 尝试次数限制：验证码只有 6 位十进制（约 90 万种），而校验接口
        // 原本没有任何失败计数，5 分钟 TTL 内足以被穷举。
        String attemptKey = ATTEMPT_PREFIX + email;
        String attemptsRaw = redisTemplate.opsForValue().get(attemptKey);
        int attempts = 0;
        if (attemptsRaw != null) {
            try {
                attempts = Integer.parseInt(attemptsRaw);
            } catch (NumberFormatException ignored) {
                attempts = 0;
            }
        }
        if (attempts >= MAX_CODE_ATTEMPTS) {
            throw BusinessException.tooManyRequests();
        }

        // 从 Redis 获取验证码
        String codeKey = RESET_CODE_PREFIX + email;
        String storedCode = redisTemplate.opsForValue().get(codeKey);

        // 验证码不存在或过期
        if (storedCode == null || !storedCode.equals(inputCode)) {
            // 累加失败次数，并与验证码同寿命（5 分钟）
            Long used = redisTemplate.opsForValue().increment(attemptKey);
            if (used != null && used == 1L) {
                redisTemplate.expire(attemptKey, Duration.ofMinutes(CODE_TTL_MINUTES));
            }
            if (used != null && used >= MAX_CODE_ATTEMPTS) {
                // 达到上限即作废验证码，强制重新发起
                redisTemplate.delete(codeKey);
            }
            throw BusinessException.invalidVerificationCode();
        }

        // 更新密码
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // 删除验证码与计数（一次性使用，防止重放）
        redisTemplate.delete(codeKey);
        redisTemplate.delete(attemptKey);

        log.info("Password reset successfully for user id={}", user.getId());
    }

    @Transactional(readOnly = true)
    public ApiResponse<AuthResponse> refreshToken(String oldToken) {
        // 仅容忍时钟偏移级别的过期窗口（5 分钟）。
        // 原实现为 7 天，配合"刷新即签发新的 24h token"且无任何吊销机制，
        // 构成事实上的永久会话：只要每 7 天刷新一次，被盗 token 永不失效，
        // 改密码也无法驱逐。
        var claims = jwtUtil.validateForRefresh(oldToken, REFRESH_GRACE_SECONDS);
        if (claims == null) {
            throw new BusinessException(40103, "Token 无效或已超过刷新有效期", HttpStatus.UNAUTHORIZED);
        }

        Long userId = Long.parseLong(claims.getSubject());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BusinessException.notFound("用户"));

        if (!user.getIsEnabled()) {
            throw BusinessException.accountDisabled();
        }

        List<String> roles = userRoleRepository.findRoleNamesByUserId(user.getId());
        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), roles);

        AuthResponse authResponse = AuthResponse.builder()
                .accessToken(token)
                .expiresIn(jwtExpirationSeconds)
                .build();

        return ApiResponse.ok(authResponse);
    }
}
