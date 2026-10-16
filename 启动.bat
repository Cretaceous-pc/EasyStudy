@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║     easyStudy 一键启动                   ║
echo  ╚══════════════════════════════════════════╝
echo.

:: ═══════════════════════════════════════════════
:: 1. 环境检查
:: ═══════════════════════════════════════════════

set "CHECK_PASS=1"

:: ── Java ──
:: 注意: 仅"安装了新 JDK"不够 —— JAVA_HOME/PATH 必须指向它，
:: 否则 Maven 仍会用旧 JDK，并以大量"非法字符"报错（文本块/switch 表达式无法解析）。
where java >nul 2>&1
if %errorlevel% neq 0 (
    echo  [X] Java 未安装或不在 PATH 中
    echo      请安装 JDK 21+ 并确保 java 命令可用
    set "CHECK_PASS=0"
) else (
    set "JAVA_MAJOR="
    for /f "tokens=3" %%i in ('java -version 2^>^&1 ^| findstr /i version') do set "JAVA_VER=%%i"
    for /f "tokens=2 delims=." %%v in ("%JAVA_VER:"=%") do set "JAVA_MAJOR=%%v"
    if not defined JAVA_MAJOR set "JAVA_MAJOR=0"
    if %JAVA_MAJOR% LSS 21 (
        echo  [X] Java 版本过低: %JAVA_VER%
        echo      本项目要求 JDK 21+^(源码使用文本块、switch 表达式等特性^)。
        echo      JAVA_HOME 当前指向: %JAVA_HOME%
        echo      仅安装新 JDK 不够，必须让 JAVA_HOME/PATH 指向它，否则 Maven 仍用旧的。
        set "CHECK_PASS=0"
    ) else (
        echo  [√] Java: %JAVA_VER%
    )
)

:: ── Maven ──
where mvn >nul 2>&1
if %errorlevel% neq 0 (
    echo  [X] Maven 未安装或不在 PATH 中
    echo      请安装 Maven 并确保 mvn 命令可用
    set "CHECK_PASS=0"
) else (
    echo  [√] Maven: 已安装
)

:: ── Node.js ──
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [X] Node.js 未安装或不在 PATH 中
    set "CHECK_PASS=0"
) else (
    for /f "tokens=1" %%i in ('node -v') do set "NODE_VER=%%i"
    echo  [√] Node.js: %NODE_VER%
)

:: ── Python (检查 python 或 python3) ──
set "PYTHON_CMD="
where python >nul 2>&1 && set "PYTHON_CMD=python"
if not defined PYTHON_CMD (
    where python3 >nul 2>&1 && set "PYTHON_CMD=python3"
)
if not defined PYTHON_CMD (
    echo  [X] Python 未安装或不在 PATH 中
    set "CHECK_PASS=0"
) else (
    for /f "tokens=2" %%i in ('%PYTHON_CMD% --version 2^>^&1') do set "PYTHON_VER=%%i"
    echo  [√] Python: %PYTHON_VER%
)

:: ── uv ──
where uv >nul 2>&1
if %errorlevel% neq 0 (
    echo  [X] uv 未安装或不在 PATH 中
    echo      请安装 uv: pip install uv 或官网安装
    set "CHECK_PASS=0"
) else (
    for /f "tokens=2" %%i in ('uv --version') do set "UV_VER=%%i"
    echo  [√] uv: %UV_VER%
)

:: ── Docker ──
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo  [X] Docker 未运行! 请先启动 Docker Desktop.
    set "CHECK_PASS=0"
) else (
    echo  [√] Docker: 运行中
)

:: ── 端口检查 ──
echo.
echo  ── 端口检查 ──
for %%p in (5432 6379 8001 9000 8080 8000 5173) do (
    netstat -an | findstr "LISTEN" | findstr ":%%p " >nul 2>&1
    if not errorlevel 1 (
        echo  [!] 端口 %%p 已被占用
    )
)

if "%CHECK_PASS%"=="0" (
    echo.
    echo  [X] 环境检查未通过，请修复上述问题后重试。
    pause
    exit /b 1
)

echo.
echo  ═══════════════════════════════════════════
echo   [√] 环境检查全部通过!
echo  ═══════════════════════════════════════════
echo.

:: ═══════════════════════════════════════════════
:: 1.5 加载 .env
::
:: 所有敏感配置（数据库口令、MinIO 口令、JWT 密钥、SMTP 授权码、
:: 大模型 API Key）只存在于 .env。.env 被 .gitignore 忽略，绝不入库。
:: 本脚本不提供任何硬编码回退值 —— 缺失即报错退出。
:: ═══════════════════════════════════════════════

if not exist ".env" (
    echo  [X] 未找到 .env 文件
    echo      请先复制模板并填写真实配置:
    echo        copy .env.example .env
    pause
    exit /b 1
)

echo  [0/4] 加载环境变量 (.env)...
for /f "usebackq eol= tokens=1,* delims==" %%a in (".env") do (
    set "_k=%%a"
    set "_v=%%b"
    call :set_env_var
)
echo  [√] 环境变量已加载

:: 关键密钥必须存在，否则后端会在启动时失败
for %%r in (JWT_SECRET DB_PASSWORD MINIO_PASSWORD) do (
    call echo %%r| findstr /r "." >nul
    if not defined %%r (
        echo  [X] .env 中缺少必填项: %%r
        pause
        exit /b 1
    )
)

goto :after_env

:set_env_var
:: 去掉键名首尾空格；值若被引号包裹则去引号
set "_k=%_k: =%"
if not defined _k goto :eof
set "_v=%_v:"=%"
set "%_k%=%_v%"
goto :eof

:after_env

:: ═══════════════════════════════════════════════
:: 2. 启动中间件 (Docker)
:: ═══════════════════════════════════════════════

echo  [1/4] 启动中间件容器...
docker compose up -d --wait postgres redis chroma minio 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [X] 中间件启动失败! 查看日志:
    docker compose logs --tail=30
    pause
    exit /b 1
)
echo  [√] 中间件已就绪

:: ═══════════════════════════════════════════════
:: 3. 启动 FastAPI (uv)
:: ═══════════════════════════════════════════════
echo  [2/4] 启动 FastAPI AI 后端...
cd backend-ai
if not exist .venv (
    echo  创建虚拟环境...
    uv venv --python 3.13
    uv pip install -r requirements.txt
)
:: 仅监听回环地址：FastAPI 无独立鉴权（身份由 Spring Boot 网关注入），
:: 绑定 0.0.0.0 会让 X-User-Id / X-User-Role 头被局域网或公网直接伪造。
start "easyStudy-FastAPI" cmd /c ".venv\Scripts\activate && uvicorn main:app --host 127.0.0.1 --port 8000"
cd ..
timeout /t 5 /nobreak >nul
echo  [√] FastAPI 已启动

:: ═══════════════════════════════════════════════
:: 4. 启动 Spring Boot
:: ═══════════════════════════════════════════════
echo  [3/4] 启动 Spring Boot 后端...
cd backend-spring
:: 凭证全部来自上面 load_env 解析的 .env，此处不再硬编码任何密钥
start "easyStudy-SpringBoot" cmd /c "mvn spring-boot:run"
cd ..
timeout /t 30 /nobreak >nul
echo  [√] Spring Boot 已启动

:: ═══════════════════════════════════════════════
:: 5. 启动前端
:: ═══════════════════════════════════════════════
echo  [4/4] 启动前端...
cd frontend
start "easyStudy-Frontend" cmd /c "npm run dev"
cd ..

echo.
echo  ═══════════════════════════════════════════
echo   [√] easyStudy 已全部启动!
echo.
echo   ── 服务地址 ──
echo   前端页面      : http://localhost:5173
echo   Spring Boot   : http://localhost:8080
echo   FastAPI       : http://localhost:8000
echo.
echo   ── 中间件端口 ──
echo   PostgreSQL    : 5432
echo   Redis         : 6379
echo   Chroma        : 8001
echo   MinIO         : 9000 (API) / 9001 (Web)
echo.
echo   ── 测试账户 ──
echo   用户名: student_li
echo   密码:   Test@12345
echo.
echo   ── 注意事项 ──
echo   Spring Boot 启动较慢（约 30-60 秒），请稍后刷新
echo   关闭此窗口不会影响已在运行的服务
echo  ═══════════════════════════════════════════
echo.
pause
