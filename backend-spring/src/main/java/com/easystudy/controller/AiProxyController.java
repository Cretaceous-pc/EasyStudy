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
import org.springframework.web.client.ResponseErrorHandler;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
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
 * 转发原始 Authorization（供下游独立验签）+ X-User-Id / X-User-Role（便于日志）
 * → 流式代理 SSE 响应
 *
 * 下游 FastAPI 不再信任 X-User-* 头，而是用共享密钥对转发的 JWT 独立验签，
 * 因此即便 FastAPI 端口意外可达，也无法仅靠伪造头冒充身份。
 * 另外 compose 已不再发布该端口（改为 expose）。
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
     * 取出调用方的原始 Bearer token，原样转发给 FastAPI 供其独立验签。
     * 返回 null 表示请求未带 Authorization —— 此时下游会以 401 拒绝。
     */
    private static String bearerOf(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        return (header != null && header.startsWith("Bearer ")) ? header : null;
    }

    /**
     * 上游返回非 2xx 时的信封包装。
     *
     * FastAPI 的错误体形如 {"detail": "..."}，没有 code/message 字段。
     * 这里把 HTTP 状态码映射为业务 code，并把 detail 作为 message 透出，
     * 使前端拿到的是「非 0 code + 真实原因」，而不是被误判成功的 code=0。
     */
    private String wrapErrorJsonToApiResponse(String rawJson, org.springframework.http.HttpStatusCode status) {
        String detail = null;
        try {
            com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(rawJson);
            if (node.hasNonNull("detail")) {
                detail = node.get("detail").asText();
            } else if (node.hasNonNull("message")) {
                detail = node.get("message").asText();
            }
        } catch (Exception e) {
            log.debug("Failed to parse upstream error body: {}", e.getMessage());
        }

        int code;
        if (status.value() == 401) {
            code = 40101;
        } else if (status.value() == 403) {
            code = 40102;
        } else if (status.value() == 404) {
            code = 40400;
        } else if (status.is4xxClientError()) {
            code = 40000 + status.value() % 100;
        } else {
            code = 50001;
        }

        ApiResponse<Void> wrapped = ApiResponse.<Void>builder()
                .code(code)
                .message(detail != null ? detail : ("AI 服务返回 " + status.value()))
                .timestamp(java.time.OffsetDateTime.now())
                .build();
        try {
            return objectMapper.writeValueAsString(wrapped);
        } catch (Exception e) {
            log.warn("Failed to serialize wrapped error: {}", e.getMessage());
            return rawJson;
        }
    }

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
     * 校验 fastapiUrl 仅指向本地/Docker 内部服务，防止 SSRF。
     *
     * 原实现用 `url.startsWith("http://localhost")` 做整串前缀匹配，可被绕过：
     *   http://localhost@169.254.169.254/   → userinfo 是 localhost，
     *                                         真实 host 是云元数据服务
     *   http://localhost.attacker.com/      → 前缀匹配成功，真实 host 是攻击者域名
     * 现在改为先解析 URI，再对 getHost() 做精确判断，并显式拒绝 userinfo。
     */
    private static void assertInternalUrl(String url) {
        java.net.URI uri;
        try {
            uri = new java.net.URI(url);
        } catch (Exception e) {
            throw new IllegalStateException("fastapi.url 无法解析: " + url);
        }

        String scheme = uri.getScheme();
        if (!"http".equalsIgnoreCase(scheme)) {
            throw new IllegalStateException("fastapi.url 仅允许 http 协议，当前: " + scheme);
        }
        // 含 userinfo 的 URL 一律拒绝（正是上面那种绕过手法）
        if (uri.getUserInfo() != null) {
            throw new IllegalStateException("fastapi.url 不允许包含用户信息段(userinfo): " + url);
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalStateException("fastapi.url 缺少主机名: " + url);
        }

        boolean allowed = "localhost".equalsIgnoreCase(host)
                || "127.0.0.1".equals(host)
                || "::1".equals(host)
                // Docker Compose 内部服务名：单个标签，不含点
                || (!host.contains(".") && host.matches("[A-Za-z0-9][A-Za-z0-9-]*"));
        if (!allowed) {
            throw new IllegalStateException(
                "fastapi.url 仅允许 localhost/127.0.0.1/::1/Docker内部服务名，防止 SSRF。当前主机: " + host
            );
        }
    }

    @PostConstruct
    public void validate() {
        assertInternalUrl(fastapiUrl);
        log.info("FastAPI proxy URL validated: {}", fastapiUrl);
    }

    /**
     * 构造转发到 FastAPI 用的 RestTemplate。
     *
     * 关键点: 关闭默认的 4xx/5xx 抛异常行为。
     * RestTemplate 默认在收到 4xx/5xx 时抛 HttpClientErrorException /
     * HttpServerErrorException，会被本类的 catch 兜住并转成
     * 502 + code 50001「AI 服务请求失败」—— 于是上游的 403（未选课）、
     * 404（资源不存在）等**业务语义全部丢失**，前端无法区分"没权限"
     * 与"服务挂了"。实测: /api/ai/resources?course_id=4 上游返回 403，
     * 经代理后变成 502。
     *
     * 这里改为不抛异常，让 ResponseEntity 原样带回上游状态码，
     * 由调用处按原状态码返回给客户端。
     */
    private RestTemplate newInternalRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(30000);
        RestTemplate restTemplate = new RestTemplate(factory);
        restTemplate.setErrorHandler(new ResponseErrorHandler() {
            @Override
            public boolean hasError(ClientHttpResponse response) {
                return false;   // 任何状态码都视为"正常响应"，交调用方处理
            }

            @Override
            public void handleError(ClientHttpResponse response) {
                // hasError 恒为 false，不会走到这里
            }
        });
        return restTemplate;
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
            String bearer = bearerOf(request);
            if (bearer != null) conn.setRequestProperty("Authorization", bearer);
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
                String bearer = bearerOf(request);
                if (bearer != null) conn.setRequestProperty("Authorization", bearer);
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
            RestTemplate restTemplate = newInternalRestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-User-Id", String.valueOf(userId));
            headers.set("X-User-Role", userRole);
            String bearer = bearerOf(request);
            if (bearer != null) headers.set("Authorization", bearer);
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

            String raw = new String(response.getBody() != null ? response.getBody() : new byte[0]);
            // 上游非 2xx 时绝不能包成 {code:0, message:"ok"} ——
            // 前端只按信封里的 code 判断成败，包成 0 会把"未选课"(403)、
            // "资源不存在"(404) 显示为成功，且丢掉真实原因。
            // 非 2xx 一律原样透传上游响应体与状态码。
            if (!response.getStatusCode().is2xxSuccessful()) {
                return ResponseEntity.status(response.getStatusCode())
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(wrapErrorJsonToApiResponse(raw, response.getStatusCode()));
            }

            return ResponseEntity.status(response.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(wrapRawJsonToApiResponse(raw));
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
            RestTemplate restTemplate = newInternalRestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-User-Id", String.valueOf(userId));
            headers.set("X-User-Role", userRole);
            String bearer = bearerOf(request);
            if (bearer != null) headers.set("Authorization", bearer);
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
            RestTemplate restTemplate = newInternalRestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-User-Id", String.valueOf(userId));
            headers.set("X-User-Role", userRole);
            String bearer = bearerOf(request);
            if (bearer != null) headers.set("Authorization", bearer);

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
