# ═══════════════════════════════════════════════════
# easyStudy — FastAPI AI 后端 Dockerfile
# ═══════════════════════════════════════════════════

FROM python:3.12-slim

WORKDIR /app

# 替换为腾讯云 apt 镜像加速（国内构建）
RUN sed -i 's/deb.debian.org/mirrors.tencentyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's|http://deb.debian.org/debian|http://mirrors.tencentyun.com/debian|g' /etc/apt/sources.list 2>/dev/null || true

# 安装系统依赖（psycopg2 需要 libpq-dev）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# pip 清华镜像加速（国内构建）
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 创建 chroma_data 目录（作为持久化卷挂载点）
RUN mkdir -p /app/chroma_data

EXPOSE 8000

# 使用 uvicorn 启动
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
