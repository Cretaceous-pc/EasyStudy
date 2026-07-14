package com.easystudy.controller;

import com.easystudy.dto.ApiResponse;
import com.easystudy.exception.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * AI 代理控制器 — Spring Boot 网关模式
 *
 * 前端请求 /api/ai/** → Spring Boot 验证 JWT → 提取 userId/roles →
 * 注入 X-User-Id / X-User-Role → 转发到 FastAPI → 流式代理 SSE 响应
 *
 * 这样 FastAPI 不对外暴露，所有请求必须经过 JWT 验证。
 */
@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiProxyController {

    @Value("${fastapi.url}")
    private String fastapiUrl;

    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 将 FastAPI 的原始 JSON 响应包裹在 ApiResponse<T> 标准格式中
     * 前端所有 API 调用（含 AI 代理）统一期望 {code, message, data, timestamp} 格式
     */
    private String wrapRawJsonToApiResponse(String rawJson) {
        try {
            Object data = objectMapper.readTree(rawJson);
            ApiResponse<Object> wrapped = ApiResponse.<Object>builder()
                    .code(0)
                    .message("ok")
                    .data(data)
                    .build();
            return objectMapper.writeValueAsString(wrapped);
        } catch (Exception e) {
            // 解析失败时降级为原始 JSON 直传
            log.warn("Failed to wrap FastAPI response: {}", e.getMessage());
            return rawJson;
        }
    }

    /**
     * 启动时校验 fastapiUrl 仅允许本地/Docker 内部地址，防止 SSRF
     */
    @PostConstruct
    public void validate() {
        String url = fastapiUrl;
        // 允许 localhost, 127.0.0.1, 以及 Docker Compose 内部服务名 (纯主机名，无点)
        boolean allowed = url.startsWith("http://localhost")
                || url.startsWith("http://127.0.0.1")
                || url.startsWith("http://[::1]");
        if (!allowed) {
            // Docker 内部: http://servicename:port (主机名不含点)
            try {
                java.net.URI uri = new java.net.URI(url);
                String host = uri.getHost();
                if (host != null && !host.contains(".") && !host.contains("://")) {
                    allowed = true;
                }
            } catch (Exception ignored) {
                // URI 解析失败，拒绝
            }
        }
        if (!allowed) {
            throw new IllegalStateException(
                "fastapi.url 仅允许 localhost/127.0.0.1/Docker内部服务名，防止 SSRF。当前值: " + fastapiUrl
            );
        }
        log.info("FastAPI proxy URL validated: {}", fastapiUrl);
    }

    /**
     * SSE 流式 POST 代理 — 用于 /api/ai/chat/send
     *
     * FastAPI 返回 Content-Type: text/event-stream，逐块转发给前端。
     */
    @PostMapping("/chat/send")
    public ResponseEntity<ResponseBodyEmitter> proxyChatSend(
            HttpServletRequest request,
            Authentication authentication,
            @RequestBody String body) {
        return proxyPostInternal(request, authentication, body);
    }

    /**
     * SSE 流式 POST 代理 — 用于 /api/ai/resources/generate
     *
     * 资源生成也是 SSE 端点，必须走流式代理，否则前端 SSE 解析失效。
     */
    @PostMapping("/resources/generate")
    public ResponseEntity<ResponseBodyEmitter> proxyResourceGenerate(
            HttpServletRequest request,
            Authentication authentication,
            @RequestBody String body) {
        return proxyPostInternal(request, authentication, body);
    }

    /**
     * 普通 JSON POST 代理 — 用于 /api/ai/chat/conversations/new 等 JSON 端点
     *
     * FastAPI 返回 Content-Type: application/json，完整读取后以 JSON 返回给前端。
     */
    @PostMapping("/**")
    public ResponseEntity<String> proxyPostJson(
            HttpServletRequest request,
            Authentication authentication,
            @RequestBody String body) {

        Long userId = (Long) authentication.getPrincipal();
        List<String> roles = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();
        String userRole = roles.isEmpty() ? "ROLE_STUDENT" : roles.get(0);

        String servletPath = request.getServletPath();
        String fastApiPath = servletPath.replace("/api/ai", "/internal");
        String targetUrl = fastapiUrl + fastApiPath;

        log.debug("Proxying JSON POST to FastAPI: {} (userId={}, role={})", targetUrl, userId, userRole);

        try {
            URI uri = new URI(targetUrl);
            HttpURLConnection conn = (HttpURLConnection) uri.toURL().openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("X-User-Id", String.valueOf(userId));
            conn.setRequestProperty("X-User-Role", userRole);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(180000); // 3 分钟，匹配 LangGraph 全链路

            conn.getOutputStream().write(body.getBytes("UTF-8"));
            conn.getOutputStream().flush();

            int responseCode = conn.getResponseCode();

            // 读取响应体
            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(responseCode == 200 ? conn.getInputStream() : conn.getErrorStream()))) {
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
            }

            conn.disconnect();

            if (responseCode != 200) {
                log.error("FastAPI JSON POST error: {} - {}", responseCode, sb);
                return ResponseEntity.status(responseCode)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(sb.toString());
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(wrapRawJsonToApiResponse(sb.toString()));

        } catch (Exception e) {
            log.error("JSON POST proxy error: {}", e.getMessage(), e);
            throw new BusinessException(50001, "AI 服务请求失败: " + e.getMessage(), HttpStatus.BAD_GATEWAY);
        }
    }

    /**
     * SSE 代理内部实现 — 异步流式转发 FastAPI 的 SSE 响应
     */
    private ResponseEntity<ResponseBodyEmitter> proxyPostInternal(
            HttpServletRequest request,
            Authentication authentication,
            String body) {

        Long userId = (Long) authentication.getPrincipal();
        List<String> roles = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();
        String userRole = roles.isEmpty() ? "ROLE_STUDENT" : roles.get(0);

        String servletPath = request.getServletPath();
        String fastApiPath = servletPath.replace("/api/ai", "/internal");
        String targetUrl = fastapiUrl + fastApiPath;

        log.debug("Proxying SSE to FastAPI: {} (userId={}, role={})", targetUrl, userId, userRole);

        ResponseBodyEmitter emitter = new ResponseBodyEmitter(300_000L);

        executor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                URI uri = new URI(targetUrl);
                conn = (HttpURLConnection) uri.toURL().openConnection();
                conn.setRequestMethod("POST");
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("X-User-Id", String.valueOf(userId));
                conn.setRequestProperty("X-User-Role", userRole);
                conn.setRequestProperty("Accept", "text/event-stream");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(300000);

                conn.getOutputStream().write(body.getBytes("UTF-8"));
                conn.getOutputStream().flush();

                int responseCode = conn.getResponseCode();
                if (responseCode != 200) {
                    StringBuilder sb = new StringBuilder();
                    try (BufferedReader reader = new BufferedReader(
                            new InputStreamReader(conn.getErrorStream() != null
                                    ? conn.getErrorStream() : conn.getInputStream()))) {
                        String line;
                        while ((line = reader.readLine()) != null) sb.append(line);
                    }
                    log.error("FastAPI SSE error: {} - {}", responseCode, sb);
                    emitter.send(sb.toString(), MediaType.APPLICATION_JSON);
                    emitter.complete();
                    return;
                }

                // 流式读取 SSE 响应
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(conn.getInputStream()))) {
                    StringBuilder buffer = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (line.isEmpty()) {
                            if (buffer.length() > 0) {
                                emitter.send(buffer.toString() + "\n\n", MediaType.TEXT_EVENT_STREAM);
                                buffer.setLength(0);
                            }
                        } else {
                            if (buffer.length() > 0) buffer.append("\n");
                            buffer.append(line);
                        }
                    }
                    if (buffer.length() > 0) {
                        emitter.send(buffer.toString() + "\n\n", MediaType.TEXT_EVENT_STREAM);
                    }
                }
                emitter.complete();
            } catch (Exception e) {
                log.error("SSE proxy error: {}", e.getMessage(), e);
                emitter.completeWithError(e);
            } finally {
                if (conn != null) conn.disconnect();
            }
        });

        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_EVENT_STREAM)
                .header("Cache-Control", "no-cache")
                .header("Connection", "keep-alive")
                .header("X-Accel-Buffering", "no")
                .body(emitter);
    }

    /**
     * GET 请求代理（用于对话列表、对话历史等非 SSE 接口）
     */
    @GetMapping("/**")
    public ResponseEntity<?> proxyGet(
            HttpServletRequest request,
            Authentication authentication) {

        Long userId = (Long) authentication.getPrincipal();
        List<String> roles = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();
        String userRole = roles.isEmpty() ? "ROLE_STUDENT" : roles.get(0);

        String servletPath = request.getServletPath();
        String fastApiPath = servletPath.replace("/api/ai", "/internal");
        String queryString = request.getQueryString();
        String targetUrl = fastapiUrl + fastApiPath;
        if (queryString != null && !queryString.isBlank()) {
            targetUrl += "?" + queryString;
        }

        try {
            // 添加连接/读超时（防止请求挂起）
            RestTemplate restTemplate = new RestTemplate();
            restTemplate.setRequestFactory(new org.springframework.http.client.SimpleClientHttpRequestFactory() {{
                setConnectTimeout(Duration.ofSeconds(5));
                setReadTimeout(Duration.ofSeconds(30));
            }});
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-User-Id", String.valueOf(userId));
            headers.set("X-User-Role", userRole);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON, MediaType.TEXT_PLAIN, MediaType.valueOf("text/markdown")));

            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    targetUrl, HttpMethod.GET, entity, byte[].class);

            MediaType contentType = response.getHeaders().getContentType();
            // 文件下载等非 JSON 响应：直接透传，不包装
            if (contentType != null && !contentType.includes(MediaType.APPLICATION_JSON)) {
                // 只拷贝安全响应头，排除 Transfer-Encoding 等 hop-by-hop 头，避免 nginx 502
                HttpHeaders safeHeaders = new HttpHeaders();
                response.getHeaders().forEach((key, values) -> {
                    String lowerKey = key.toLowerCase();
                    if (lowerKey == null) return;
                    if (lowerKey.equals("transfer-encoding")
                        || lowerKey.equals("connection")
                        || lowerKey.equals("keep-alive")
                        || lowerKey.equals("proxy-authenticate")
                        || lowerKey.equals("proxy-authorization")
                        || lowerKey.equals("te")
                        || lowerKey.equals("trailer")
                        || lowerKey.equals("upgrade")
                        || lowerKey.equals("server")
                        || lowerKey.equals("date")) {
                        return;
                    }
                    safeHeaders.put(key, values);
                });
                return ResponseEntity.status(response.getStatusCode())
                        .contentType(contentType)
                        .headers(safeHeaders)
                        .body(response.getBody());
            }

            return ResponseEntity.status(response.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(wrapRawJsonToApiResponse(new String(response.getBody() != null ? response.getBody() : new byte[0])));
        } catch (Exception e) {
            log.error("GET proxy error: {}", e.getMessage(), e);
            throw new BusinessException(50001, "AI 服务请求失败", HttpStatus.BAD_GATEWAY);
        }
    }

    /**
     * PUT 请求代理（用于路径节点状态更新等接口）
     */
    @PutMapping("/**")
    public ResponseEntity<String> proxyPut(
            HttpServletRequest request,
            Authentication authentication,
            @RequestBody String body) {

        Long userId = (Long) authentication.getPrincipal();
        List<String> roles = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();
        String userRole = roles.isEmpty() ? "ROLE_STUDENT" : roles.get(0);

        String servletPath = request.getServletPath();
        String fastApiPath = servletPath.replace("/api/ai", "/internal");
        String targetUrl = fastapiUrl + fastApiPath;

        log.debug("Proxying PUT to FastAPI: {} (userId={}, role={})", targetUrl, userId, userRole);

        try {
            RestTemplate restTemplate = new RestTemplate();
            restTemplate.setRequestFactory(new org.springframework.http.client.SimpleClientHttpRequestFactory() {{
                setConnectTimeout(Duration.ofSeconds(5));
                setReadTimeout(Duration.ofSeconds(30));
            }});
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-User-Id", String.valueOf(userId));
            headers.set("X-User-Role", userRole);
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    targetUrl, HttpMethod.PUT, entity, String.class);

            return ResponseEntity.status(response.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(wrapRawJsonToApiResponse(response.getBody()));
        } catch (Exception e) {
            log.error("PUT proxy error: {}", e.getMessage(), e);
            throw new BusinessException(50001, "AI 服务请求失败", HttpStatus.BAD_GATEWAY);
        }
    }

    /**
     * 应用关闭时清理线程池
     */
    @PreDestroy
    public void destroy() {
        executor.shutdown();
        try {
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                executor.shutdownNow();
            }
        } catch (InterruptedException e) {
            executor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    /**
     * DELETE 请求代理（用于删除会话等接口）
     */
    @DeleteMapping("/**")
    public ResponseEntity<String> proxyDelete(
            HttpServletRequest request,
            Authentication authentication) {

        Long userId = (Long) authentication.getPrincipal();
        List<String> roles = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();
        String userRole = roles.isEmpty() ? "ROLE_STUDENT" : roles.get(0);

        String servletPath = request.getServletPath();
        String fastApiPath = servletPath.replace("/api/ai", "/internal");
        String queryString = request.getQueryString();
        String targetUrl = fastapiUrl + fastApiPath;
        if (queryString != null && !queryString.isBlank()) {
            targetUrl += "?" + queryString;
        }

        try {
            RestTemplate restTemplate = new RestTemplate();
            restTemplate.setRequestFactory(new org.springframework.http.client.SimpleClientHttpRequestFactory() {{
                setConnectTimeout(Duration.ofSeconds(5));
                setReadTimeout(Duration.ofSeconds(30));
            }});
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-User-Id", String.valueOf(userId));
            headers.set("X-User-Role", userRole);

            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    targetUrl, HttpMethod.DELETE, entity, String.class);

            return ResponseEntity.status(response.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(wrapRawJsonToApiResponse(response.getBody()));
        } catch (Exception e) {
            log.error("DELETE proxy error: {}", e.getMessage(), e);
            throw new BusinessException(50001, "AI 服务请求失败", HttpStatus.BAD_GATEWAY);
        }
    }
}
