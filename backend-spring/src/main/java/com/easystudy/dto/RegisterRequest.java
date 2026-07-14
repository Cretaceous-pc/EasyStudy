package com.easystudy.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank(message = "用户名不能为空")
    @Size(min = 3, max = 32, message = "用户名长度3-32字符")
    @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "用户名只能包含字母、数字和下划线")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Size(min = 8, max = 64, message = "密码长度8-64字符")
    private String password;

    @Size(max = 128, message = "邮箱长度不能超过128字符")
    private String email;

    @NotBlank(message = "显示名不能为空")
    @Size(min = 1, max = 32, message = "显示名长度1-32字符")
    private String displayName;
}
