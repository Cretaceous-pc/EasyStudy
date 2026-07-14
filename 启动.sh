#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo ""
echo " ╔══════════════════════════════════════════╗"
echo " ║     easyStudy 一键启动                   ║"
echo " ╚══════════════════════════════════════════╝"
echo ""

# ═══════════════════════════════════════════════════════
# 1. 环境检查
# ═══════════════════════════════════════════════════════

CHECK_PASS=true

# ── 颜色定义 ──
GREEN='\033[32m'
RED='\033[31m'
YELLOW='\033[33m'
RESET='\033[0m'

check_cmd() {
    local name="$1"
    local cmd="$2"
    local hint="$3"
    if command -v "$cmd" >/dev/null 2>&1; then
        local ver=$($cmd --version 2>&1 | head -1)
        echo -e " ${GREEN}[√]${RESET} $name: $ver"
        return 0
    else
        echo -e " ${RED}[X]${RESET} $name 未安装或不在 PATH 中"
        [ -n "$hint" ] && echo "      $hint"
        CHECK_PASS=false
        return 1
    fi
}

# ── Java ──
check_cmd "Java" "java" "请安装 JDK 17+ 并确保 java 命令可用"

# ── Maven ──
check_cmd "Maven" "mvn" "请安装 Maven 并确保 mvn 命令可用"

# ── Node.js ──
check_cmd "Node.js" "node"

# ── Python ──
PYTHON_CMD=""
command -v python3 >/dev/null 2>&1 && PYTHON_CMD=python3
command -v python >/dev/null 2>&1 && PYTHON_CMD=python
if [ -n "$PYTHON_CMD" ]; then
    pyver=$($PYTHON_CMD --version 2>&1 | head -1)
    echo -e " ${GREEN}[√]${RESET} Python: $pyver"
else
    echo -e " ${RED}[X]${RESET} Python 未安装"
    CHECK_PASS=false
fi

# ── uv ──
check_cmd "uv" "uv" "请安装 uv: curl -LsSf https://astral.sh/uv/install.sh | sh"

# ── Docker ──
if docker info >/dev/null 2>&1; then
    echo -e " ${GREEN}[√]${RESET} Docker: 运行中"
else
    echo -e " ${RED}[X]${RESET} Docker 未运行! 请先启动 Docker."
    CHECK_PASS=false
fi

# ── 端口检查 ──
echo ""
echo " ── 端口检查 ──"
for port in 5432 6379 8001 9000 8080 8000 5173; do
    if ss -tlnp "sport = :$port" 2>/dev/null | grep -q ":$port" || \
       netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        echo -e " ${YELLOW}[!]${RESET} 端口 $port 已被占用"
    fi
done

if [ "$CHECK_PASS" = false ]; then
    echo ""
    echo -e " ${RED}[X] 环境检查未通过，请修复上述问题后重试。${RESET}"
    exit 1
fi

echo ""
echo " ═══════════════════════════════════════════"
echo -e "  ${GREEN}[√] 环境检查全部通过!${RESET}"
echo " ═══════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════
# 2. 启动中间件 (Docker)
# ═══════════════════════════════════════════════════════

echo " [1/4] 启动中间件容器..."
docker compose up -d --wait postgres redis chroma minio
echo -e " ${GREEN}[√]${RESET} 中间件已就绪"

# ═══════════════════════════════════════════════════════
# 3. 启动 FastAPI (uv)
# ═══════════════════════════════════════════════════════
echo " [2/4] 启动 FastAPI AI 后端..."
cd backend-ai
if [ ! -d .venv ]; then
    echo "  创建虚拟环境..."
    uv venv --python 3.13
    uv pip install -r requirements.txt
fi
source .venv/bin/activate
nohup uvicorn main:app --host 0.0.0.0 --port 8000 --reload > /tmp/easystudy-fastapi.log 2>&1 &
deactivate
cd ..
sleep 5
echo -e " ${GREEN}[√]${RESET} FastAPI 已启动"

# ═══════════════════════════════════════════════════════
# 4. 启动 Spring Boot
# ═══════════════════════════════════════════════════════
echo " [3/4] 启动 Spring Boot 后端..."
cd backend-spring
export JWT_SECRET=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
export DB_USER=easystudy
export DB_PASSWORD=easystudy_dev_2026
export MINIO_USER=easystudy_admin
export MINIO_PASSWORD=easystudy_minio_2026
export MAIL_HOST=smtp.qq.com
export MAIL_USERNAME=189673895@qq.com
export MAIL_PASSWORD=xedvwryypcsfbgeg
nohup mvn spring-boot:run -q > /tmp/easystudy-springboot.log 2>&1 &
cd ..
sleep 30
echo -e " ${GREEN}[√]${RESET} Spring Boot 已启动"

# ═══════════════════════════════════════════════════════
# 5. 启动前端
# ═══════════════════════════════════════════════════════
echo " [4/4] 启动前端..."
cd frontend
nohup npm run dev > /tmp/easystudy-frontend.log 2>&1 &
cd ..

echo ""
echo " ═══════════════════════════════════════════"
echo -e "  ${GREEN}[√] easyStudy 已全部启动!${RESET}"
echo ""
echo "  ── 服务地址 ──"
echo "  前端页面      : http://localhost:5173"
echo "  Spring Boot   : http://localhost:8080"
echo "  FastAPI       : http://localhost:8000"
echo ""
echo "  ── 中间件端口 ──"
echo "  PostgreSQL    : 5432"
echo "  Redis         : 6379"
echo "  Chroma        : 8001"
echo "  MinIO         : 9000 (API) / 9001 (Web)"
echo ""
echo "  ── 测试账户 ──"
echo "  用户名: student_li"
echo "  密码:   Test@12345"
echo ""
echo "  ── 注意事项 ──"
echo "  Spring Boot 启动较慢（约 30-60 秒），请稍后刷新"
echo "  日志文件: /tmp/easystudy-*.log"
echo " ═══════════════════════════════════════════"
echo ""
