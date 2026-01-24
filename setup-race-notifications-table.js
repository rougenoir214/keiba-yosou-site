// race_notificationsテーブルを作成するスクリプト
require('dotenv').config();
const db = require('./db/connection');

async function createRaceNotificationsTable() {
  try {
    console.log('race_notificationsテーブルを作成中...');
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS race_notifications (
        id SERIAL PRIMARY KEY,
        race_id INTEGER REFERENCES races(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        notification_type VARCHAR(50) NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(race_id, user_id, notification_type)
      );
    `);
    
    console.log('✅ race_notificationsテーブルを作成しました');
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_race_notifications_race_id 
      ON race_notifications(race_id);
    `);
    
    console.log('✅ インデックス idx_race_notifications_race_id を作成しました');
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_race_notifications_sent_at 
      ON race_notifications(sent_at);
    `);
    
    console.log('✅ インデックス idx_race_notifications_sent_at を作成しました');
    
    console.log('\n✅ すべてのテーブルとインデックスを作成しました！');
    process.exit(0);
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

createRaceNotificationsTable();
