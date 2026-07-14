package com.easystudy.controller;

import com.easystudy.dto.ApiResponse;
import com.easystudy.dto.PageResponse;
import com.easystudy.dto.UserDto;
import com.easystudy.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
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
            @RequestBody Map<String, Boolean> body) {
        boolean isEnabled = body.getOrDefault("is_enabled", true);
        UserDto user = userService.toggleUserStatus(userId, isEnabled);
        return ResponseEntity.ok(ApiResponse.ok(user));
    }
}
