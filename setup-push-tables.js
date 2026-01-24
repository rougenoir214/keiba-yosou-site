// プッシュ購読テーブルを作成するスクリプト
require('dotenv').config();
const db = require('./db/connection');

async function createPushSubscriptionsTable() {
  try {
    console.log('プッシュ購読テーブルを作成中...');
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        keys_p256dh TEXT NOT NULL,
        keys_auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, endpoint)
      );
    `);
    
    console.log('✅ push_subscriptions テーブルを作成しました');
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id 
      ON push_subscriptions(user_id);
    `);
    
    console.log('✅ インデックス idx_push_subscriptions_user_id を作成しました');
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint 
      ON push_subscriptions(endpoint);
    `);
    
    console.log('✅ インデックス idx_push_subscriptions_endpoint を作成しました');
    
    console.log('\n✅ すべてのテーブルとインデックスを作成しました！');
    process.exit(0);
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

createPushSubscriptionsTable();
