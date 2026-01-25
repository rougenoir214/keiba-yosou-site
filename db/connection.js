const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  client_encoding: 'UTF8',
  connectionTimeoutMillis: 10000, // 接続タイムアウト: 10秒
  idleTimeoutMillis: 30000, // アイドルタイムアウト: 30秒
  max: 20, // 最大接続数
  statement_timeout: 30000, // クエリタイムアウト: 30秒
});

// データベースセッションのタイムゾーンを日本時間に設定
pool.on('connect', (client) => {
  client.query('SET timezone = "Asia/Tokyo"');
});

// エラーハンドリング
pool.on('error', (err, client) => {
  console.error('Unexpected database error:', err);
});

module.exports = pool;
