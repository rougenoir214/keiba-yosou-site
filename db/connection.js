const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase用SSL設定（本番・開発共通）
  ssl: {
    rejectUnauthorized: false
  },
  client_encoding: 'UTF8',
  // より保守的なプール設定に変更
  max: 5, // 接続数を削減（15 → 5）
  min: 1, // 最小接続数を削減（2 → 1）
  idleTimeoutMillis: 10000, // アイドルタイムアウトを短縮: 10秒
  connectionTimeoutMillis: 15000, // 接続タイムアウトを延長: 15秒
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
