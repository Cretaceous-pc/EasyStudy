package com.easystudy.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDto {
    private Long userId;
    private String username;
    private String displayName;
    private String email;
    private String avatarUrl;
    private Boolean isEnabled;
    private List<String> roles;
    private String role;
    private OffsetDateTime createdAt;
}
