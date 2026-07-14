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
where java >nul 2>&1
if %errorlevel% neq 0 (
    echo  [X] Java 未安装或不在 PATH 中
    echo      请安装 JDK 17+ 并确保 java 命令可用
    set "CHECK_PASS=0"
) else (
    for /f "tokens=3" %%i in ('java -version 2^>^&1 ^| findstr /i version') do set "JAVA_VER=%%i"
    echo  [√] Java: %JAVA_VER%
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
    netstat -an | findstr "LISTEN" | findstr "%%p" >nul 2>&1
    if !errorlevel! equ 0 (
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
start "easyStudy-FastAPI" cmd /c ".venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
cd ..
timeout /t 5 /nobreak >nul
echo  [√] FastAPI 已启动

:: ═══════════════════════════════════════════════
:: 4. 启动 Spring Boot
:: ═══════════════════════════════════════════════
echo  [3/4] 启动 Spring Boot 后端...
cd backend-spring
set "JWT_SECRET=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
set "DB_USER=easystudy"
set "DB_PASSWORD=easystudy_dev_2026"
set "MINIO_USER=easystudy_admin"
set "MINIO_PASSWORD=easystudy_minio_2026"
set "MAIL_HOST=smtp.qq.com"
set "MAIL_USERNAME=189673895@qq.com"
set "MAIL_PASSWORD=xedvwryypcsfbgeg"
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
