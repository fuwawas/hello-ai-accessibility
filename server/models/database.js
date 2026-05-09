const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'hello-ai.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

async function initDatabase() {
  const database = getDb();

  // 创建用户表
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      nickname TEXT,
      disability_type TEXT DEFAULT 'general',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      is_active INTEGER DEFAULT 1
    )
  `);

  // 创建用户设置表
  database.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      setting_key TEXT NOT NULL,
      setting_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, setting_key)
    )
  `);

  // 创建使用记录表
  database.exec(`
    CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      module TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // 创建 AI 对话记录表
  database.exec(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      module TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // 创建索引
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON usage_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_conv ON ai_conversations(conversation_id);
  `);

  console.log('数据库表结构已就绪');
}

module.exports = { getDb, initDatabase };
