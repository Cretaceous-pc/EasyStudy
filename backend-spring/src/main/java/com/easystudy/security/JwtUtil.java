package com.easystudy.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;

@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expirationSeconds;

    public JwtUtil(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration}") long expirationSeconds
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationSeconds = expirationSeconds;
    }

    public long getExpirationSeconds() {
        return expirationSeconds;
    }

    public String generateToken(Long userId, String username, List<String> roles) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationSeconds * 1000);

        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("username", username)
                .claim("roles", roles)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key, Jwts.SIG.HS384)  // 显式指定 HS384，与 FastAPI algorithms=["HS384"] 一致
                .compact();
    }

    public Long extractUserId(String token) {
        return Long.parseLong(getClaims(token).getSubject());
    }

    @SuppressWarnings("unchecked")
    public List<String> extractRoles(String token) {
        return getClaims(token).get("roles", List.class);
    }

    public String extractUsername(String token) {
        return getClaims(token).get("username", String.class);
    }

    public boolean isTokenValid(String token) {
        try {
            getClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    /**
     * 一次性解析并校验，返回 Claims。
     *
     * 原实现在 JwtAuthFilter 中对同一个 token 依次调用了
     * isTokenValid / extractUserId / extractUsername / extractRoles，
     * 每次都重新解析并验签一遍（单请求 4 次 HMAC 验签）。改为解析一次。
     *
     * @throws JwtException 签名无效、过期、算法不匹配等
     */
    public Claims parse(String token) {
        return getClaims(token);
    }

    public Long userIdOf(Claims claims) {
        return Long.parseLong(claims.getSubject());
    }

    /** 从 Claims 取角色；容忍字符串或列表两种形态，永不返回 null */
    public List<String> rolesOf(Claims claims) {
        Object roles = claims.get("roles");
        if (roles instanceof List<?> list) {
            return list.stream().map(String::valueOf).toList();
        }
        if (roles instanceof String s) {
            return List.of(s);
        }
        return List.of();
    }

    /**
     * 刷新 Token 专用验证：允许已过期但在宽限期（默认 5 分钟）内的 Token。
     * 标准 isTokenValid() 对过期 Token 返回 false，
     * 此方法忽略 ExpiredJwtException，仅验证签名和基础结构。
     *
     * 注意：宽限期原为 7 天，配合"刷新即签发新 24h token"构成永久会话 ——
     * 只要每 7 天刷新一次，被盗 token 就永远不会失效。现收紧为仅容忍时钟偏移。
     *
     * @param token  待刷新的 JWT
     * @param graceWindowSeconds  过期后仍允许刷新的宽限期（秒）
     * @return 解析出的 Claims（即使过期），验证失败返回 null
     */
    public Claims validateForRefresh(String token, long graceWindowSeconds) {
        try {
            return getClaims(token);
        } catch (ExpiredJwtException e) {
            // 检查是否在宽限期内
            long expiredAt = e.getClaims().getExpiration().getTime();
            long now = System.currentTimeMillis();
            long graceWindowMs = graceWindowSeconds * 1000;

            if (now - expiredAt <= graceWindowMs) {
                return e.getClaims();
            }
            return null;
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                // 显式限制为 HS384：jjwt 0.12 中一旦向 sig() 添加算法，
                // 头部 alg 不属于该集合的 token 会被拒绝（原本 HS256/512 也接受）。
                .sig().add(Jwts.SIG.HS384).and()
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
