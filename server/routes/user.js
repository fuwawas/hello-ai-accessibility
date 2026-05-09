const express = require('express');
const { getDb } = require('../models/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 获取用户设置
router.get('/settings', authMiddleware, (req, res) => {
  const db = getDb();
  const settings = db.prepare(
    'SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?'
  ).all(req.user.id);

  const settingsObj = {};
  settings.forEach(s => {
    try {
      settingsObj[s.setting_key] = JSON.parse(s.setting_value);
    } catch {
      settingsObj[s.setting_key] = s.setting_value;
    }
  });

  res.json({ settings: settingsObj });
});

// 保存用户设置
router.post('/settings', authMiddleware, (req, res) => {
  const { settings } = req.body;

  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: '设置数据格式错误' });
  }

  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO user_settings (user_id, setting_key, setting_value, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, setting_key)
    DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
  `);

  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      upsert.run(req.user.id, key, JSON.stringify(value));
    }
  });

  transaction();

  res.json({ message: '设置保存成功' });
});

// 更新用户资料
router.put('/profile', authMiddleware, (req, res) => {
  const { nickname, email, disability_type } = req.body;
  const db = getDb();

  const updates = [];
  const values = [];

  if (nickname !== undefined) {
    updates.push('nickname = ?');
    values.push(nickname);
  }
  if (email !== undefined) {
    updates.push('email = ?');
    values.push(email);
  }
  if (disability_type !== undefined) {
    updates.push('disability_type = ?');
    values.push(disability_type);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有需要更新的字段' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(req.user.id);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const user = db.prepare('SELECT id, username, email, nickname, disability_type FROM users WHERE id = ?').get(req.user.id);

  res.json({ message: '资料更新成功', user });
});

// 删除账户
router.delete('/account', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(req.user.id);
  res.json({ message: '账户已停用' });
});

module.exports = router;
