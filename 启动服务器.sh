#!/bin/bash
# Hello AI 无障碍辅助 - 启动服务器
# 双击运行或在终端执行: bash 启动服务器.sh

echo "========================================"
echo "  Hello AI 无障碍辅助 - 启动服务器"
echo "========================================"
echo ""

cd "$(dirname "$0")"

# 检查 Python 是否可用
if command -v python3 &> /dev/null; then
    PYTHON=python3
elif command -v python &> /dev/null; then
    PYTHON=python
else
    echo "[错误] 未找到 Python，请先安装 Python 3"
    echo "下载地址: https://www.python.org/downloads/"
    read -p "按回车键退出..."
    exit 1
fi

PORT=8080

echo "[信息] 正在启动本地服务器..."
echo "[信息] 服务器地址: http://localhost:$PORT"
echo ""
echo "启动后请在浏览器中打开以下地址:"
echo ""
echo "    http://localhost:$PORT"
echo ""
echo "按 Ctrl+C 可以停止服务器"
echo "========================================"
echo ""

# 尝试自动打开浏览器
open_url() {
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:$PORT" 2>/dev/null &
    elif command -v open &> /dev/null; then
        open "http://localhost:$PORT" 2>/dev/null &
    elif command -v start &> /dev/null; then
        start "http://localhost:$PORT" 2>/dev/null &
    fi
}

# 延迟2秒后打开浏览器
(sleep 2 && open_url) &

$PYTHON -m http.server $PORT
