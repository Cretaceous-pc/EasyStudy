@echo off
chcp 65001 >nul
echo ============================================
echo   easyStudy -- 插入测试数据
echo ============================================
echo.
echo 第一步：插入用户和课程...
python "%~dp0seed-data.py"
if %errorlevel% neq 0 (
    echo ❌ 第一步失败！请确认 Docker 正在运行。
    pause
    exit /b 1
)
echo.
echo 第二步：插入演示数据（对话、资源、路径）...
type "%~dp0seed-test-data.sql" | docker exec -i easystudy-postgres psql -U easystudy -d easystudy 2>nul
echo.
echo ============================================
echo   完成！
echo.
echo   测试账号:
echo     管理员: admin / Test@12345
echo     教师:   teacher_wang / Test@12345
echo     学生:   student_li / Test@12345
echo.
echo   种子脚本可重复运行，已存在用户不会被覆盖。
echo ============================================
pause
