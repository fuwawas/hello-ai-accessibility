@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   Hello AI 无障碍辅助 - 启动服务器
echo ========================================
echo.

:: 检查 Python 是否可用
where python >nul 2>&1
if %errorlevel% neq 0 (
    where python3 >nul 2>&1
    if %errorlevel% neq 0 (
        echo [错误] 未找到 Python，请先安装 Python 3
        echo 下载地址: https://www.python.org/downloads/
        pause
        exit /b 1
    )
    set PYTHON=python3
) else (
    set PYTHON=python
)

echo [信息] 正在启动本地服务器...
echo [信息] 服务器地址: http://localhost:8080
echo.
echo 启动后请在浏览器中打开以下地址:
echo.
echo     http://localhost:8080
echo.
echo 按 Ctrl+C 可以停止服务器
echo ========================================
echo.

cd /d "%~dp0"
%PYTHON% -m http.server 8080

pause
