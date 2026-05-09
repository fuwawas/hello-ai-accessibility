const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../models/database');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, nickname, disability_type } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: '用户名长度应为 3-20 个字符' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少 6 个字符' });
    }

    const db = getDb();

    // 检查用户名是否已存在
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 加密密码
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 插入用户
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, nickname, disability_type) VALUES (?, ?, ?, ?, ?)'
    ).run(username, email || null, passwordHash, nickname || username, disability_type || 'general');

    // 生成 JWT
    const token = jwt.sign(
      { id: result.lastInsertRowid, username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: result.lastInsertRowid,
        username,
        nickname: nickname || username,
        disability_type: disability_type || 'general'
      }
    });
  } catch (err) {
    console.error('注册错误:', err);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 更新最后登录时间
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // 生成 JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        email: user.email,
        disability_type: user.disability_type
      }
    });
  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, email, nickname, disability_type, created_at, last_login FROM users WHERE id = ?').get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  res.json({ user });
});

// 修改密码
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
      return res.status(400).json({ error: '请提供旧密码和新密码' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: '新密码长度至少 6 个字符' });
    }

    const db = getDb();
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);

    const validPassword = await bcrypt.compare(old_password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: '旧密码错误' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(new_password, salt);

    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(passwordHash, req.user.id);

    res.json({ message: '密码修改成功' });
  } catch (err) {
    console.error('修改密码错误:', err);
    res.status(500).json({ error: '修改密码失败' });
  }
});

module.exports = router;
