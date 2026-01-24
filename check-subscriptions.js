// プッシュ購読情報を確認するスクリプト
require('dotenv').config();
const db = require('./db/connection');

async function checkSubscriptions() {
  try {
    const result = await db.query('SELECT * FROM push_subscriptions');
    console.log('=== プッシュ購読情報 ===');
    console.log(`件数: ${result.rows.length}`);
    if (result.rows.length > 0) {
      result.rows.forEach((row, index) => {
        console.log(`\n[${index + 1}]`);
        console.log(`  ID: ${row.id}`);
        console.log(`  User ID: ${row.user_id}`);
        console.log(`  Endpoint: ${row.endpoint.substring(0, 50)}...`);
        console.log(`  Created: ${row.created_at}`);
      });
    } else {
      console.log('購読情報が登録されていません');
    }
    process.exit(0);
  } catch (error) {
    console.error('エラー:', error);
    process.exit(1);
  }
}

checkSubscriptions();
