# ═══════════════════════════════════════════════════
# easyStudy — FastAPI AI 后端 Dockerfile
# ═══════════════════════════════════════════════════

FROM python:3.12-slim

WORKDIR /app

# 替换为腾讯云 apt 镜像加速（国内构建）
RUN sed -i 's/deb.debian.org/mirrors.tencentyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's|http://deb.debian.org/debian|http://mirrors.tencentyun.com/debian|g' /etc/apt/sources.list 2>/dev/null || true

# pip 清华镜像加速（国内构建）
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 安装 Python 依赖
#
# 注意: requirements.txt 使用 psycopg2-binary（自带 manylinux wheel），
# 不需要 gcc/g++/libpq-dev。原实现把这三个编译工具装进运行镜像，
# 既放大镜像体积也扩大攻击面（容器内可直接编译利用代码）。
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码（.dockerignore 已排除 .env / chroma_data / __pycache__ 等）
COPY . .

# 创建 chroma_data 目录（作为持久化卷挂载点）
RUN mkdir -p /app/chroma_data

# 以非 root 运行：创建专用用户并交出应用目录属主
RUN useradd --system --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# 使用 uvicorn 启动
# 注意: 不加 --reload —— 该进程不是被 Spring Boot 网关之外的任何人访问，
# 也不应把开发期热重载带上生产。
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
