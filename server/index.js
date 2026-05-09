require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDatabase } = require('./models/database');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const aiRoutes = require('./routes/ai');
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// 限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: '请求过于频繁，请稍后再试' }
});
app.use('/api/', limiter);

// 解析 JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（前端）
app.use(express.static(path.join(__dirname, '..')));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/stats', statsRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA 回退 - 所有非 API 路由返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || '服务器内部错误'
  });
});

// 初始化数据库并启动服务器
async function start() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
      console.log(`API 文档: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

start();
