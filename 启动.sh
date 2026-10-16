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
if command -v java >/dev/null 2>&1; then
    JAVA_RAW=$(java -version 2>&1 | head -1)
    # 从 "openjdk version \"21.0.1\" ..." 或 "java version \"1.8.0_504\"" 中取主版本号
    JAVA_MAJOR=$(echo "$JAVA_RAW" | sed -n 's/.*version "\([0-9]*\).*/\1/p')
    if [ -n "$JAVA_MAJOR" ] && [ "$JAVA_MAJOR" -ge 21 ] 2>/dev/null; then
        echo -e " ${GREEN}[√]${RESET} Java: $JAVA_RAW"
    else
        echo -e " ${RED}[X]${RESET} Java 版本过低: $JAVA_RAW"
        echo "      本项目要求 JDK 21+（源码使用文本块、switch 表达式等 21 特性）。"
        echo "      JAVA_HOME 当前指向: ${JAVA_HOME:-未设置}"
        echo "      仅安装新 JDK 不够，必须让 JAVA_HOME/PATH 指向它，否则 Maven 仍用旧的。"
        CHECK_PASS=false
    fi
else
    echo -e " ${RED}[X]${RESET} Java 未安装或不在 PATH 中"
    echo "      请安装 JDK 21+ 并确保 java 命令可用"
    CHECK_PASS=false
fi

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
# ═══════════════════════════════════════════════════════
# 2.5 加载 .env
#
# 所有敏感配置（数据库口令、MinIO 口令、JWT 密钥、SMTP 授权码、
# 大模型 API Key）只存在于 .env。.env 被 .gitignore 忽略，绝不入库。
# 本脚本不提供任何硬编码回退值 —— 缺失即报错退出，避免"用示例密钥跑起来"。
# ═══════════════════════════════════════════════════════

load_env() {
    if [ ! -f .env ]; then
        echo -e " ${RED}[X] 未找到 .env 文件${RESET}"
        echo "     请先复制模板并填写真实配置:"
        echo "       cp .env.example .env"
        exit 1
    fi

    # 逐行解析 KEY=VALUE，跳过注释与空行；值两侧的单/双引号会被去掉。
    # 用 set -a 让每个赋值自动导出，子进程（mvn / uvicorn）即可继承。
    local _prev_opts
    _prev_opts=$(set +o)
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        line="${line%$'\r'}"                        去掉 Windows 换行残留
        case "$line" in
            ''|''*) continue ;;
        esac
        case "$line" in
            *=*) ;;
            *) continue ;;
        esac
        local key="${line%%=*}"
        local val="${line*=}"
        # 去掉行尾注释（仅当值未被引号包裹时）
        case "$val" in
            \"*\"|\'*\') ;;
            *) val="${val%%*}" ;;
        esac
        # 去掉包裹引号
        val="${val%\"}"; val="${val\"}"
        val="${val%\'}"; val="${val\'}"
        key="$(echo "$key" | tr -d '[:space:]')"
        [ -z "$key" ] && continue
        export "$key=$val"
    done < .env
    eval "$_prev_opts"
}

echo " [0/4] 加载环境变量 (.env)..."
load_env
echo -e " ${GREEN}[√]${RESET} 环境变量已加载"

# 关键密钥必须存在，否则后端会在启动时失败 —— 这里提前给出明确原因
for _required in JWT_SECRET DB_PASSWORD MINIO_PASSWORD; do
    if [ -z "$(eval echo "\$$_required")" ]; then
        echo -e " ${RED}[X] .env 中缺少必填项: $_required${RESET}"
        exit 1
    fi
done

echo " [2/4] 启动 FastAPI AI 后端..."
cd backend-ai
if [ ! -d .venv ]; then
    echo "  创建虚拟环境..."
    uv venv --python 3.13
    uv pip install -r requirements.txt
fi
source .venv/bin/activate
# 仅监听回环地址：FastAPI 无独立鉴权（身份由 Spring Boot 网关注入），
# 绑定 0.0.0.0 会让 X-User-Id / X-User-Role 头被局域网或公网直接伪造。
nohup uvicorn main:app --host 127.0.0.1 --port 8000 > /tmp/easystudy-fastapi.log 2>&1 &
deactivate
cd ..
sleep 5
echo -e " ${GREEN}[√]${RESET} FastAPI 已启动"

# ═══════════════════════════════════════════════════════
# 4. 启动 Spring Boot
# ═══════════════════════════════════════════════════════
echo " [3/4] 启动 Spring Boot 后端..."
cd backend-spring
# 凭证全部来自上面的 load_env（.env），此处不再硬编码任何密钥
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
