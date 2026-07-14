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

        // 检查邮箱是否已存在
        if (request.getEmail() != null && !request.getEmail().isBlank()
                && userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException(40001, "邮箱已被注册", HttpStatus.BAD_REQUEST);
        }

        // 查找角色 — 注册固定分配 ROLE_STUDENT，防止权限提升
        Role role = roleRepository.findByName("ROLE_STUDENT")
                .orElseThrow(() -> BusinessException.invalidRole());

        // 创建用户
        User user = User.builder()
                .username(request.getUsername())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .email(request.getEmail())
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

    public void forgotPassword(ForgotPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        // 检查邮箱是否已注册
        if (!userRepository.existsByEmail(email)) {
            throw BusinessException.emailNotRegistered();
        }

        // 频率限制：同一邮箱 60 秒内只能请求一次
        String rateLimitKey = RATE_LIMIT_PREFIX + email;
        Boolean isLimited = redisTemplate.hasKey(rateLimitKey);
        if (Boolean.TRUE.equals(isLimited)) {
            throw BusinessException.tooManyRequests();
        }

        // 生成 6 位验证码
        String code = emailService.generateCode();

        // 存入 Redis，5 分钟过期
        String codeKey = RESET_CODE_PREFIX + email;
        redisTemplate.opsForValue().set(codeKey, code, Duration.ofMinutes(CODE_TTL_MINUTES));

        // 设置频率限制 key，60 秒过期
        redisTemplate.opsForValue().set(rateLimitKey, "1", Duration.ofSeconds(RATE_LIMIT_SECONDS));

        // 发送邮件
        emailService.sendVerificationCode(email, code);

        log.info("Password reset code sent to email: {}", email);
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        String inputCode = request.getCode().trim();
        String newPassword = request.getNewPassword();

        // 检查邮箱是否已注册
        User user = userRepository.findByEmail(email)
                .orElseThrow(BusinessException::emailNotRegistered);

        // 从 Redis 获取验证码
        String codeKey = RESET_CODE_PREFIX + email;
        String storedCode = redisTemplate.opsForValue().get(codeKey);

        // 验证码不存在或过期
        if (storedCode == null || !storedCode.equals(inputCode)) {
            throw BusinessException.invalidVerificationCode();
        }

        // 更新密码
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // 删除验证码（一次性使用，防止重放）
        redisTemplate.delete(codeKey);

        log.info("Password reset successfully for user id={}, email={}", user.getId(), email);
    }

    @Transactional(readOnly = true)
    public ApiResponse<AuthResponse> refreshToken(String oldToken) {
        // 验证旧 Token：在过期后 7 天宽限期内仍允许刷新
        var claims = jwtUtil.validateForRefresh(oldToken, 7 * 24 * 3600);
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
