const express = require('express');
const { getDb } = require('../models/database');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// 记录使用日志
router.post('/log', optionalAuth, (req, res) => {
  const { action, module, details } = req.body;

  if (!action) {
    return res.status(400).json({ error: '请提供操作类型' });
  }

  const db = getDb();
  db.prepare(
    'INSERT INTO usage_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)'
  ).run(req.user?.id || null, action, module || null, details ? JSON.stringify(details) : null);

  res.json({ message: '记录成功' });
});

// 获取用户使用统计
router.get('/user', authMiddleware, (req, res) => {
  const db = getDb();

  // 总使用次数
  const totalLogs = db.prepare(
    'SELECT COUNT(*) as count FROM usage_logs WHERE user_id = ?'
  ).get(req.user.id);

  // 各模块使用次数
  const moduleStats = db.prepare(`
    SELECT module, COUNT(*) as count
    FROM usage_logs
    WHERE user_id = ? AND module IS NOT NULL
    GROUP BY module
    ORDER BY count DESC
  `).all(req.user.id);

  // 最近 7 天使用趋势
  const weeklyTrend = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM usage_logs
    WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
    GROUP BY DATE(created_at)
    ORDER BY date
  `).all(req.user.id);

  // 今日使用次数
  const todayLogs = db.prepare(
    "SELECT COUNT(*) as count FROM usage_logs WHERE user_id = ? AND DATE(created_at) = DATE('now')"
  ).get(req.user.id);

  res.json({
    total: totalLogs.count,
    today: todayLogs.count,
    modules: moduleStats,
    weeklyTrend
  });
});

// 获取全局统计（匿名）
router.get('/global', (req, res) => {
  const db = getDb();

  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get();
  const totalLogs = db.prepare('SELECT COUNT(*) as count FROM usage_logs').get();
  const todayUsers = db.prepare(
    "SELECT COUNT(DISTINCT user_id) as count FROM usage_logs WHERE DATE(created_at) = DATE('now') AND user_id IS NOT NULL"
  ).get();

  const moduleStats = db.prepare(`
    SELECT module, COUNT(*) as count
    FROM usage_logs
    WHERE module IS NOT NULL
    GROUP BY module
    ORDER BY count DESC
  `).all();

  res.json({
    totalUsers: totalUsers.count,
    totalUsage: totalLogs.count,
    todayUsers: todayUsers.count,
    modules: moduleStats
  });
});

module.exports = router;
