package com.easystudy.config;

import io.minio.MinioClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MinioConfig {

    @Value("${minio.endpoint}")
    private String endpoint;

    @Value("${minio.access-key}")
    private String accessKey;

    @Value("${minio.secret-key}")
    private String secretKey;

    @Bean
    public MinioClient minioClient() {
        // MinIO Java SDK 需要带 scheme 的 URL（如 http://localhost:9000）
        // .env 中 MINIO_ENDPOINT 是 host:port 格式（与 Python 端共用）
        String url = endpoint.startsWith("http") ? endpoint : "http://" + endpoint;
        return MinioClient.builder()
                .endpoint(url)
                .credentials(accessKey, secretKey)
                .build();
    }
}
