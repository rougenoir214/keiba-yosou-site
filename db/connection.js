const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase用SSL設定（本番・開発共通）
  ssl: {
    rejectUnauthorized: false
  },
  client_encoding: 'UTF8',
  // Supabaseのプール設定に合わせて最適化
  max: 15, // Supabaseのプールサイズに合わせる
  min: 2, // 最小接続数
  idleTimeoutMillis: 20000, // アイドル接続のタイムアウト: 20秒
  connectionTimeoutMillis: 10000, // 接続確立のタイムアウト: 10秒
  statement_timeout: 30000, // クエリタイムアウト: 30秒
  query_timeout: 30000, // 追加のクエリタイムアウト
  // 接続の健全性チェック
  allowExitOnIdle: false,
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
      const retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', '57P01', '08006'];
      if (!retryableErrors.includes(error.code) && !error.message.includes('timeout')) {
        throw error;
      }

      // 指数バックオフで待機（1秒 → 2秒 → 4秒）
      const waitTime = Math.pow(2, attempt - 1) * 1000;
      console.log(`Retrying after ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

module.exports = pool;
module.exports.queryWithRetry = queryWithRetry;
