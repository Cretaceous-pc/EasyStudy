package com.easystudy.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * 启动时校验关键配置项，防止敏感信息使用空值或硬编码默认值运行
 */
@Slf4j
@Configuration
public class ConfigValidation {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${spring.datasource.password}")
    private String dbPassword;

    @Value("${minio.secret-key}")
    private String minioSecretKey;

    @PostConstruct
    public void validate() {
        checkNotBlank("jwt.secret", jwtSecret, "JWT 密钥未配置，请设置环境变量 JWT_SECRET");
        checkNotBlank("spring.datasource.password", dbPassword, "数据库密码未配置，请设置环境变量 DB_PASSWORD");
        checkNotBlank("minio.secret-key", minioSecretKey, "MinIO 密钥未配置，请设置环境变量 MINIO_PASSWORD");

        // JWT 密钥长度校验（HS384 至少 48 字节）
        if (jwtSecret.length() < 48) {
            throw new IllegalStateException("jwt.secret 长度不足（HS384 至少 48 字符），当前: " + jwtSecret.length());
        }

        log.info("✅ 配置校验通过: JWT/DB/MinIO 密钥均已设置");
    }

    private void checkNotBlank(String key, String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(message + " (配置项: " + key + ")");
        }
    }
}
