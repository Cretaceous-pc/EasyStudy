# tencent 服务器部署说明（study.iocheng.com）

> 记录线上实际部署形态，供日后维护与复现。**不含任何密钥**。

## 基本信息

| 项 | 值 |
|---|---|
| 主机 | `tencent` → `122.51.52.103`（`~/.ssh/config` 别名，root/22） |
| 域名 | `https://study.iocheng.com` |
| 代码目录 | `/root/easyStudy`（**非 git 仓库**，通过 scp/rsync 同步） |
| 前端静态目录 | `/root/easystudy/html`（nginx 的 root） |
| compose 项目 | `easystudy` |
| 对外端口 | 22 / 80 / 443 / 8888（其余被腾讯云安全组拦截） |

## 架构：混合模式

```
browser ──443──> 宿主 nginx (/etc/nginx/sites-available/easystudy)
                    ├── /            → 静态文件 /root/easystudy/html
                    └── /api/        → 127.0.0.1:8080 (Spring Boot 容器)
                                          └── http://fastapi:8000 (容器内网)
docker: postgres / redis / chroma / minio （均为**命名卷**）
```

**注意**：前端**不使用**容器（`easystudy-frontend` 从未启动）。前端是
`npm run build` 后把 `dist/` 拷到 `/root/easystudy/html`。

## ⚠️ 关键陷阱（都踩过）

### 1. 生效的 nginx 配置不是宝塔目录下那份

```
生效:  /etc/nginx/sites-available/easystudy   (sites-enabled/easystudy 符号链接)
       ↑ 主配置 include /etc/nginx/sites-enabled/*
失效:  /www/server/panel/vhost/nginx/easystudy.conf
       ↑ 主配置**不** include 该目录，改它没有任何效果
```

### 2. 数据在命名卷里，不能用仓库的 docker-compose.yml

```
easystudy_postgres_data   76M
easystudy_minio_data      78M
easystudy_chroma_data     26M
easystudy_redis_data
```

仓库版 compose 用 bind mount（`./data/postgres`）。直接替换会让容器挂到
新的空卷上 → 线上数据"消失"。必须用本目录的 `docker-compose.override.yml`
做增量覆盖。

### 3. Compose 的 ports 是列表合并，不是替换

若 override 里不写 `!override`，会保留原有的 `0.0.0.0:6379` 再追加
`127.0.0.1:6379` → 同一端口两条绑定 → 容器启动失败。

### 4. 宿主 nginx 已占用 8081 / 8082

`easystudy.conf` 有 4 个 server 块（80 默认 404、80 域名、443 域名、
8081）。给 frontend 容器选端口时避开 8081/8082，当前用 8083。

### 5. add_header 在子 location 会覆盖父级

nginx 的 `add_header` 不继承：只要某个 location 里写了 `add_header`，
server 级的安全头在该 location 会**全部丢失**。因此各 location 内一律
不写 `add_header`。

## 日常操作

```bash
cd /root/easyStudy

# 查看状态
docker compose ps

# 更新代码（服务器非 git 仓库，从 GitHub 取）
git clone --depth 1 https://github.com/Cretaceous-pc/EasyStudy.git /tmp/es-new
cp -a /tmp/es-new/backend-spring/. backend-spring/
cp -a /tmp/es-new/backend-ai/.     backend-ai/
cp -a /tmp/es-new/frontend/.       frontend/

# 重建后端
docker compose build springboot fastapi
docker compose up -d springboot fastapi redis

# 重建并发布前端（静态文件，不走容器）
cd frontend && npm ci && npm run build
cp -a dist/. /root/easystudy/html/
```

## 回滚

备份位于 `/root/easystudy-backup-<时间戳>/`：

| 文件 | 内容 |
|---|---|
| `easystudy_postgres_data.tar.gz` | PostgreSQL 命名卷 |
| `easystudy_minio_data.tar.gz` | MinIO 命名卷 |
| `easystudy_chroma_data.tar.gz` | Chroma 命名卷 |
| `easystudy_redis_data.tar.gz` | Redis 命名卷 |
| `easyStudy-config.tar.gz` | compose / .env / scripts |
| `app-source-before-*.tar.gz` | 替换前的应用源码 |
| `html-before-*.tar.gz` | 替换前的前端静态文件 |
| `env-before-*` / `nginx-easystudy.conf.before` | 单项配置 |

恢复命名卷示例：

```bash
docker compose down
docker run --rm -v easystudy_postgres_data:/dst -v /root/easystudy-backup-XXX:/bk \
  alpine sh -c 'cd /dst && tar xzf /bk/easystudy_postgres_data.tar.gz'
docker compose up -d
```

## 2026-10-16 本次部署内容

- 应用层换为修复版：关闭匿名资料读取、资料列表/上传越权、可控
  Content-Type 导致的存储型 XSS、前端 markdown 未消毒、AI 代理 4xx 被
  包装成 502、FastAPI 身份改为 JWT 验签（不再信任 `X-User-Id` 头）
- 前端重新构建并发布（含 `rehype-sanitize`）；`tsconfig` 类型检查由
  空转变为真实生效
- Redis 启用 `requirepass`（原为**完全无口令**）
- 中间件端口从 `0.0.0.0` 收紧到 `127.0.0.1`
- 宿主 nginx 增加安全响应头（CSP / nosniff / X-Frame-Options /
  Referrer-Policy / Permissions-Policy）与 `client_max_body_size 21m`
- 数据零差异：20 用户 / 3 课程 / 72 资料 / 1901 切片 / 40 会话
- 线上端到端验证 9/9 通过
