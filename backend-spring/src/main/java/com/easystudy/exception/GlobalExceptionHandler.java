package com.easystudy.exception;

import com.easystudy.dto.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException e) {
        log.warn("Business error: code={}, message={}", e.getCode(), e.getMessage());
        return ResponseEntity.status(e.getHttpStatus())
                .body(ApiResponse.error(e.getCode(), e.getMessage(), e.getDetail()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .reduce((a, b) -> a + "; " + b)
                .orElse("参数校验失败");
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(40001, msg));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuth(AuthenticationException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error(40101, "认证失败", e.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(40102, "权限不足", e.getMessage()));
    }

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleUploadTooLarge(
            org.springframework.web.multipart.MaxUploadSizeExceededException e) {
        // 未处理时会被 handleAll 兜成 500「服务器内部错误」，
        // 用户无法区分"文件太大"和"服务坏了"。
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(ApiResponse.error(40002, "上传文件过大，单文件上限 20MB"));
    }

    @ExceptionHandler(org.springframework.web.bind.MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingParam(
            org.springframework.web.bind.MissingServletRequestParameterException e) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(40001, "缺少必需参数: " + e.getParameterName()));
    }

    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException e) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(40001, "参数类型不正确: " + e.getName()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException e) {
        // 分页参数非法（如 page=0 / pageSize=-1）会由 PageRequest 抛出该异常，
        // 原实现返回 500，语义上应为 400。
        log.warn("Illegal argument: {}", e.getMessage());
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(40001, "请求参数不合法"));
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrity(
            org.springframework.dao.DataIntegrityViolationException e) {
        // 并发下的"先查后插"竞态（重复注册、重复选课）会撞唯一约束。
        // 原实现落到 handleAll 返回 500，前端无法区分冲突与故障。
        log.warn("Data integrity violation: {}", e.getMostSpecificCause().getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(40902, "操作冲突：数据已存在或被其它请求修改"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleAll(Exception e) {
        log.error("Unhandled exception", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(50001, "服务器内部错误"));
    }
}
