#!/bin/bash
echo ""
echo "========================================"
echo "  Hello AI 无障碍辅助 - 后端启动"
echo "========================================"
echo ""

echo "[1/2] 安装依赖..."
npm install
cd server && npm install && cd ..

echo ""
echo "[2/2] 启动服务器..."
echo "服务地址: http://localhost:3000"
echo "按 Ctrl+C 停止服务器"
echo ""

node server/index.js
