@echo off
echo ========================================
echo   Hello AI - Start Server
echo ========================================
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    where python3 >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERROR] Python not found.
        echo Please install Python 3: https://www.python.org/downloads/
        pause
        exit /b 1
    )
    set PYTHON=python3
) else (
    set PYTHON=python
)

echo [INFO] Starting server...
echo [INFO] URL: http://localhost:8080
echo.
echo Press Ctrl+C to stop
echo ========================================
echo.

cd /d "%~dp0"
%PYTHON% -m http.server 8080 --bind 127.0.0.1

pause
