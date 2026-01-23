const { Pool } = require('pg');
require('dotenv').config();

// デバッグ用ログ
console.log('=== Database Connection Debug ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'undefined');
console.log('SSL設定:', process.env.NODE_ENV === 'production' ? 'enabled' : 'disabled');
console.log('================================');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  client_encoding: 'UTF8'
});

module.exports = pool;
