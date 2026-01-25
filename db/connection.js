const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  client_encoding: 'UTF8'
});

// データベースセッションのタイムゾーンを日本時間に設定
pool.on('connect', (client) => {
  client.query('SET timezone = "Asia/Tokyo"');
});

module.exports = pool;
