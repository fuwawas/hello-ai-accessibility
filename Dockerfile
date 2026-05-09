FROM node:20-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装生产依赖
RUN npm ci --only=production

# 复制所有文件
COPY . .

# 创建数据目录
RUN mkdir -p /app/server/data

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 启动命令
CMD ["node", "server/index.js"]
