package com.easystudy.service;

import com.easystudy.dto.PageParams;
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
        int safePage = PageParams.page(page);
        int safePageSize = PageParams.pageSize(pageSize);
        Pageable pageable = PageRequest.of(safePage - 1, safePageSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<User> users;

        if (role != null && !role.isBlank()) {
            // 角色筛选下推到数据库：原实现在内存里只过滤"当前页"，
            // 却返回未过滤的 total，既漏数据又给出错误的分页统计。
            String kw = (keyword != null && !keyword.isBlank()) ? keyword : null;
            users = userRepository.findByRoleAndKeyword(role, kw, pageable);
        } else if (keyword != null && !keyword.isBlank()) {
            users = userRepository.findByUsernameContainingOrDisplayNameContaining(
                    keyword, keyword, pageable);
        } else {
            users = userRepository.findAll(pageable);
        }

        Page<UserDto> dtoPage = users.map(this::toUserDto);
        return PageResponse.of(dtoPage);
    }

    private UserDto toUserDto(User user) {
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
    }

    @Transactional
    public UserDto toggleUserStatus(Long userId, boolean isEnabled) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BusinessException.notFound("用户"));

        user.setIsEnabled(isEnabled);
        userRepository.save(user);

        log.info("User status changed: id={}, enabled={}", userId, isEnabled);
        return toUserDto(user);
    }
}
