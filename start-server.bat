@echo off
echo ========================================
echo   Hello AI - Start Server
echo ========================================
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    where python3 >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERROR] Python not found. Please install Python 3 first.
        echo Download: https://www.python.org/downloads/
        pause
        exit /b 1
    )
    set PYTHON=python3
) else (
    set PYTHON=python
)

echo [INFO] Starting local server...
echo [INFO] URL: http://localhost:8080
echo.
echo Open this URL in your browser:
echo.
echo     http://localhost:8080
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

cd /d "%~dp0"
%PYTHON% -m http.server 8080

pause
