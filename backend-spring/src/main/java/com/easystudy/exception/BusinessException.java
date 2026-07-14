package com.easystudy.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class BusinessException extends RuntimeException {

    private final int code;
    private final HttpStatus httpStatus;
    private final String detail;

    public BusinessException(int code, String message, HttpStatus httpStatus) {
        super(message);
        this.code = code;
        this.httpStatus = httpStatus;
        this.detail = null;
    }

    public BusinessException(int code, String message, String detail, HttpStatus httpStatus) {
        super(message);
        this.code = code;
        this.httpStatus = httpStatus;
        this.detail = detail;
    }

    public static BusinessException of(int code, String message, HttpStatus httpStatus) {
        return new BusinessException(code, message, httpStatus);
    }

    public static BusinessException usernameExists() {
        return new BusinessException(40001, "用户名已存在", HttpStatus.BAD_REQUEST);
    }

    public static BusinessException invalidCredentials() {
        return new BusinessException(40101, "用户名或密码错误", HttpStatus.UNAUTHORIZED);
    }

    public static BusinessException accountDisabled() {
        return new BusinessException(40102, "账号已被禁用", HttpStatus.FORBIDDEN);
    }

    public static BusinessException invalidRole() {
        return new BusinessException(40003, "角色值非法", HttpStatus.BAD_REQUEST);
    }

    public static BusinessException notFound(String what) {
        return new BusinessException(40401, what + "不存在", HttpStatus.NOT_FOUND);
    }

    public static BusinessException conflict(int code, String message) {
        return new BusinessException(code, message, HttpStatus.CONFLICT);
    }

    // ── 忘记密码相关 ──

    public static BusinessException emailNotRegistered() {
        return new BusinessException(40402, "该邮箱未注册", HttpStatus.NOT_FOUND);
    }

    public static BusinessException tooManyRequests() {
        return new BusinessException(42901, "操作过于频繁，请稍后再试", HttpStatus.TOO_MANY_REQUESTS);
    }

    public static BusinessException invalidVerificationCode() {
        return new BusinessException(40002, "验证码无效或已过期", HttpStatus.BAD_REQUEST);
    }
}
