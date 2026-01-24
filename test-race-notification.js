// レース通知スケジューラーのテスト用スクリプト
// 使い方: node test-race-notification.js

require('dotenv').config();
const db = require('./db/connection');

async function testNotificationLogic() {
  console.log('=== レース通知ロジックのテスト ===\n');

  try {
    // 1. 現在時刻から30分後（±2分）のレースを検索
    console.log('1️⃣ 30分後のレースを検索中...');
    const racesQuery = `
      SELECT 
        r.id as race_id,
        r.race_name,
        r.race_date,
        r.race_time,
        EXTRACT(EPOCH FROM (CAST(r.race_time AS TIME) - CURRENT_TIME::TIME))/60 as minutes_until
      FROM races r
      WHERE r.race_date = CURRENT_DATE
        AND CAST(r.race_time AS TIME) BETWEEN 
          (CURRENT_TIME::TIME + INTERVAL '28 minutes') 
          AND (CURRENT_TIME::TIME + INTERVAL '32 minutes')
      ORDER BY r.race_time
    `;
    
    const racesResult = await db.query(racesQuery);
    
    if (racesResult.rows.length === 0) {
      console.log('   ❌ 30分後のレースがありません');
      console.log('   💡 テスト用に今日のレース一覧を表示します:\n');
      
      const todayRacesQuery = `
        SELECT 
          r.id,
          r.race_name,
          r.race_time,
          EXTRACT(EPOCH FROM (CAST(r.race_time AS TIME) - CURRENT_TIME::TIME))/60 as minutes_until
        FROM races r
        WHERE r.race_date = CURRENT_DATE
        ORDER BY r.race_time
        LIMIT 10
      `;
      
      const todayResult = await db.query(todayRacesQuery);
      
      if (todayResult.rows.length === 0) {
        console.log('   ❌ 今日のレースがありません');
      } else {
        console.log('   📋 今日のレース一覧:');
        todayResult.rows.forEach(race => {
          const minutesUntil = Math.round(race.minutes_until);
          console.log(`      ${race.id}: ${race.race_name} - ${race.race_time} (${minutesUntil > 0 ? `${minutesUntil}分後` : `${Math.abs(minutesUntil)}分前`})`);
        });
      }
      
      process.exit(0);
      return;
    }

    console.log(`   ✅ ${racesResult.rows.length}件のレースが見つかりました\n`);

    // 2. 各レースについて通知対象ユーザーを確認
    for (const race of racesResult.rows) {
      console.log(`2️⃣ レース: ${race.race_name} (ID: ${race.race_id})`);
      console.log(`   発走時刻: ${race.race_time} (${Math.round(race.minutes_until)}分後)`);

      // 予想を投稿したユーザーを取得
      const usersQuery = `
        SELECT DISTINCT 
          p.user_id,
          u.display_name,
          u.username
        FROM predictions p
        JOIN users u ON p.user_id = u.id
        WHERE p.race_id = $1
      `;
      
      const usersResult = await db.query(usersQuery, [race.race_id]);
      
      if (usersResult.rows.length === 0) {
        console.log('   ℹ️  このレースに予想したユーザーはいません\n');
        continue;
      }

      console.log(`   👥 予想したユーザー: ${usersResult.rows.length}名`);

      // 各ユーザーのプッシュ購読状況を確認
      for (const user of usersResult.rows) {
        const subsQuery = `
          SELECT COUNT(*) as subscription_count
          FROM push_subscriptions
          WHERE user_id = $1
        `;
        
        const subsResult = await db.query(subsQuery, [user.user_id]);
        const hasSubscription = subsResult.rows[0].subscription_count > 0;

        // 既に通知送信済みかチェック
        const notifiedQuery = `
          SELECT COUNT(*) as notified_count
          FROM race_notifications
          WHERE race_id = $1 AND user_id = $2 AND notification_type = '30min_before'
        `;
        
        const notifiedResult = await db.query(notifiedQuery, [race.race_id, user.user_id]);
        const alreadyNotified = notifiedResult.rows[0].notified_count > 0;

        const status = !hasSubscription ? '🔕 未登録' : alreadyNotified ? '✅ 送信済み' : '📬 送信対象';
        console.log(`      ${status} - ${user.display_name} (${user.username})`);
      }
      
      console.log('');
    }

    console.log('✅ テスト完了');
    process.exit(0);
  } catch (error) {
    console.error('❌ エラー:', error);
    process.exit(1);
  }
}

testNotificationLogic();
