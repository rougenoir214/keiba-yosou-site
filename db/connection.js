const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  client_encoding: 'UTF8',
  connectionTimeoutMillis: 20000, // 接続タイムアウト: 20秒に延長
  idleTimeoutMillis: 30000, // アイドルタイムアウト: 30秒
  max: 10, // 最大接続数を10に削減
  statement_timeout: 30000, // クエリタイムアウト: 30秒
});

// エラーハンドリング
pool.on('error', (err, client) => {
  console.error('Unexpected database error:', err);
  console.error('Error details:', {
    message: err.message,
    code: err.code,
    stack: err.stack
  });
});

// 接続時のログ
pool.on('connect', (client) => {
  console.log('Database connection established');
  client.query('SET timezone = "Asia/Tokyo"');
});

// 接続取得時のログ
pool.on('acquire', (client) => {
  console.log('Client acquired from pool');
});

// 接続解放時のログ
pool.on('remove', (client) => {
  console.log('Client removed from pool');
});

/**
 * 再試行機能付きクエリ実行
 * @param {string} query - SQL クエリ
 * @param {Array} params - クエリパラメータ
 * @param {number} maxRetries - 最大再試行回数（デフォルト: 3）
 */
async function queryWithRetry(query, params = [], maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await pool.query(query, params);
      return result;
    } catch (error) {
      console.error(`Query attempt ${attempt}/${maxRetries} failed:`, {
        error: error.message,
        code: error.code,
        query: query.substring(0, 100) + '...'
      });

      // 最後の試行でもエラーの場合は例外をスロー
      if (attempt === maxRetries) {
        throw error;
      }

      // 接続タイムアウトやネットワークエラーの場合のみ再試行
      const retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', '57P01', '08006', 'ECONNREFUSED'];
      if (!retryableErrors.includes(error.code) && !error.message.includes('timeout')) {
        throw error;
      }

      // 指数バックオフで待機（2秒 → 4秒 → 8秒）
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`Retrying after ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

module.exports = pool;
module.exports.queryWithRetry = queryWithRetry;
