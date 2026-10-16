package com.easystudy.controller;

import com.easystudy.dto.ApiResponse;
import com.easystudy.dto.PageResponse;
import com.easystudy.dto.UserDto;
import com.easystudy.exception.BusinessException;
import com.easystudy.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /** 用户列表（管理员）— 支持分页、角色筛选、关键词搜索 */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<ApiResponse<PageResponse<UserDto>>> listUsers(
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "page_size", defaultValue = "20") int pageSize,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String keyword) {
        PageResponse<UserDto> result = userService.listUsers(page, pageSize, role, keyword);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /** 启用/禁用用户（管理员） */
    @PutMapping("/{userId}/status")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserDto>> toggleUserStatus(
            @PathVariable Long userId,
            @RequestBody Map<String, Object> body,
            Authentication authentication) {
        Object raw = body.get("is_enabled");
        // 原实现用 Map<String,Boolean> + getOrDefault(true)，存在两个问题：
        //   1. {"is_enabled": null} 会因拆箱抛 NPE -> 500
        //   2. 键名拼错（如 isEnabled）时 getOrDefault 返回 true —— 意图是
        //      "禁用"却把账号启用了（fail-open）
        // 现改为显式校验：键必须存在且为布尔值。
        if (raw == null) {
            throw new BusinessException(40001, "缺少 is_enabled 参数", org.springframework.http.HttpStatus.BAD_REQUEST);
        }
        if (!(raw instanceof Boolean)) {
            throw new BusinessException(40001, "is_enabled 必须为布尔值", org.springframework.http.HttpStatus.BAD_REQUEST);
        }
        boolean isEnabled = (Boolean) raw;

        // 防止管理员把自己停用后无法再登录（自锁）
        Long requesterId = (Long) authentication.getPrincipal();
        if (!isEnabled && requesterId.equals(userId)) {
            throw new BusinessException(40001, "不能停用当前登录的管理员账号", org.springframework.http.HttpStatus.BAD_REQUEST);
        }

        UserDto user = userService.toggleUserStatus(userId, isEnabled);
        return ResponseEntity.ok(ApiResponse.ok(user));
    }
}
