***REMOVED*** ═══════════════════════════════════════════════════
***REMOVED*** easyStudy — React 前端 Dockerfile
***REMOVED*** 多阶段构建: Node 编译 → Nginx 静态服务（非 root）
***REMOVED*** ═══════════════════════════════════════════════════

***REMOVED*** ── 阶段 1: 编译 ──
FROM node:22-alpine AS builder
WORKDIR /build

***REMOVED*** npm 镜像源可通过构建参数覆盖（不硬编码第三方源，便于审计与复现）
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN npm config set registry "$NPM_REGISTRY"

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

***REMOVED*** ── 阶段 2: Nginx 静态服务 ──
***REMOVED*** 使用 unprivileged 变体：以 UID 101 运行，不需要 root 权限，
***REMOVED*** 因此容器内无需 CAP_NET_BIND_SERVICE 等能力。
FROM nginxinc/nginx-unprivileged:1.27-alpine

***REMOVED*** 复制构建产物
COPY --from=builder /build/dist /usr/share/nginx/html

***REMOVED*** Nginx 配置：SPA 路由 + API 反代
COPY nginx.conf /etc/nginx/conf.d/default.conf
***REMOVED*** 安全响应头片段（被 nginx.conf 的多个 location include）
COPY security-headers.conf /etc/nginx/conf.d/security-headers.conf

***REMOVED*** 非 root：镜像默认 USER 101，此处显式声明以免基镜像变更影响
USER 101

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
