package com.easystudy.service;

import com.easystudy.dto.PageResponse;
import com.easystudy.dto.UserDto;
import com.easystudy.exception.BusinessException;
import com.easystudy.model.User;
import com.easystudy.repository.UserRepository;
import com.easystudy.repository.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;

    @Transactional(readOnly = true)
    public PageResponse<UserDto> listUsers(int page, int pageSize, String role, String keyword) {
        Pageable pageable = PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<User> users;

        if (keyword != null && !keyword.isBlank()) {
            users = userRepository.findByUsernameContainingOrDisplayNameContaining(
                    keyword, keyword, pageable);
        } else {
            users = userRepository.findAll(pageable);
        }

        Page<UserDto> dtoPage = users.map(user -> {
            List<String> roles = userRoleRepository.findRoleNamesByUserId(user.getId());
            return UserDto.builder()
                    .userId(user.getId())
                    .username(user.getUsername())
                    .displayName(user.getDisplayName())
                    .email(user.getEmail())
                    .avatarUrl(user.getAvatarUrl())
                    .roles(roles)
                    .isEnabled(user.getIsEnabled())
                    .createdAt(user.getCreatedAt())
                    .build();
        });

        // 如果指定了角色筛选（纯内存过滤，数据量不大时可用）
        if (role != null && !role.isBlank()) {
            var filtered = dtoPage.getContent().stream()
                    .filter(u -> u.getRoles() != null && u.getRoles().contains(role))
                    .toList();
            return PageResponse.of(filtered, dtoPage.getTotalElements(), page, pageSize);
        }

        return PageResponse.of(dtoPage);
    }

    @Transactional
    public UserDto toggleUserStatus(Long userId, boolean isEnabled) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BusinessException.notFound("用户"));

        user.setIsEnabled(isEnabled);
        userRepository.save(user);

        List<String> roles = userRoleRepository.findRoleNamesByUserId(user.getId());
        log.info("User {} {}: id={}, username={}",
                isEnabled ? "enabled" : "disabled", isEnabled ? "启用" : "禁用",
                userId, user.getUsername());

        return UserDto.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .email(user.getEmail())
                .avatarUrl(user.getAvatarUrl())
                .roles(roles)
                .isEnabled(user.getIsEnabled())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
