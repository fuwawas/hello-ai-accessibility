@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   Hello AI 无障碍辅助 - 后端启动
echo ========================================
echo.

echo [1/2] 安装依赖...
call npm install
cd server
call npm install
cd ..

echo.
echo [2/2] 启动服务器...
echo 服务地址: http://localhost:3000
echo 按 Ctrl+C 停止服务器
echo.

node server/index.js
pause
