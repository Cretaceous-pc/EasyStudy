# ═══════════════════════════════════════════════════
# easyStudy — React 前端 Dockerfile
# 多阶段构建: Node 编译 → Nginx 静态服务
# ═══════════════════════════════════════════════════

# ── 阶段 1: 编译 ──
FROM node:22-alpine AS builder
WORKDIR /build

# npm 淘宝镜像加速（国内构建）
RUN npm config set registry https://registry.npmmirror.com

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── 阶段 2: Nginx 静态服务 ──
FROM nginx:1.27-alpine

# 复制构建产物
COPY --from=builder /build/dist /usr/share/nginx/html

# Nginx 配置：SPA 路由 + API 反代
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
