// レース通知スケジューラーのテスト用スクリプト（1日1回督促通知版）
// 使い方: node test-race-notification.js

require('dotenv').config();
const db = require('./db/connection');

async function testNotificationLogic() {
  console.log('=== 1日1回督促通知ロジックのテスト ===\n');

  try {
    // 1. 本日の最初のレースを検索
    console.log('1️⃣ 本日の最初のレースを検索中...');
    const firstRaceQuery = `
      SELECT 
        r.id as race_id,
        r.race_name,
        r.race_date,
        r.race_time,
        EXTRACT(EPOCH FROM (CAST(r.race_time AS TIME) - CURRENT_TIME::TIME))/60 as minutes_until
      FROM races r
      WHERE r.race_date = CURRENT_DATE
      ORDER BY r.race_time ASC
      LIMIT 1
    `;
    
    const firstRaceResult = await db.query(firstRaceQuery);
    
    if (firstRaceResult.rows.length === 0) {
      console.log('   ❌ 本日のレースがありません');
      console.log('   💡 テスト用に今後のレース一覧を表示します:\n');
      
      const upcomingRacesQuery = `
        SELECT 
          r.id,
          r.race_name,
          r.race_date,
          r.race_time
        FROM races r
        WHERE r.race_date >= CURRENT_DATE
        ORDER BY r.race_date, r.race_time
        LIMIT 10
      `;
      
      const upcomingResult = await db.query(upcomingRacesQuery);
      
      if (upcomingResult.rows.length === 0) {
        console.log('   ❌ 今後のレースがありません');
      } else {
        console.log('   📋 今後のレース一覧:');
        upcomingResult.rows.forEach(race => {
          console.log(`      ${race.race_date} ${race.race_time}: ${race.race_name} (ID: ${race.id})`);
        });
      }
      
      process.exit(0);
      return;
    }

    const firstRace = firstRaceResult.rows[0];
    const minutesUntil = Math.round(firstRace.minutes_until);

    console.log(`   ✅ 最初のレース: ${firstRace.race_name}`);
    console.log(`   📅 発走日時: ${firstRace.race_date} ${firstRace.race_time}`);
    console.log(`   ⏱️  発走まで: ${minutesUntil}分`);
    
    if (minutesUntil < 28 || minutesUntil > 32) {
      console.log(`   ℹ️  まだ通知タイミングではありません（30分前: 28〜32分の範囲外）`);
    } else {
      console.log(`   🎯 30分前です！通知を送信するタイミングです`);
    }

    console.log('\n2️⃣ プッシュ通知登録者を確認中...');

    // プッシュ通知が有効なユーザーを全員取得
    const allUsersQuery = `
      SELECT DISTINCT ps.user_id, u.display_name, u.username
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.id
    `;
    
    const allUsersResult = await db.query(allUsersQuery);
    
    if (allUsersResult.rows.length === 0) {
      console.log('   ❌ プッシュ通知を登録しているユーザーがいません\n');
      process.exit(0);
      return;
    }

    console.log(`   ✅ プッシュ通知登録者: ${allUsersResult.rows.length}名\n`);

    // 3. 各ユーザーの予想状況と通知状況を確認
    console.log('3️⃣ 各ユーザーの状態を確認中...\n');

    for (const user of allUsersResult.rows) {
      console.log(`👤 ${user.display_name} (${user.username})`);

      // 今日既に予想しているかチェック
      const predictionCheckQuery = `
        SELECT COUNT(*) as prediction_count
        FROM predictions p
        JOIN races r ON p.race_id = r.race_id
        WHERE p.user_id = $1 AND r.race_date = CURRENT_DATE
      `;
      
      const predictionResult = await db.query(predictionCheckQuery, [user.user_id]);
      const predictionCount = predictionResult.rows[0].prediction_count;
      const hasPrediction = predictionCount > 0;

      // 今日既に通知を送信したかチェック
      const notificationCheckQuery = `
        SELECT COUNT(*) as notification_count
        FROM race_notifications
        WHERE user_id = $1 
          AND notification_type = 'daily_reminder'
          AND DATE(sent_at) = CURRENT_DATE
      `;
      
      const notificationResult = await db.query(notificationCheckQuery, [user.user_id]);
      const alreadyNotified = notificationResult.rows[0].notification_count > 0;

      console.log(`   📊 今日の予想: ${hasPrediction ? `${predictionCount}件` : 'なし'}`);
      console.log(`   📬 本日の通知: ${alreadyNotified ? '送信済み' : '未送信'}`);
      
      // 通知対象かどうか
      if (!hasPrediction && !alreadyNotified) {
        console.log(`   🎯 通知対象: YES（予想なし & 未通知）`);
      } else if (hasPrediction) {
        console.log(`   ⏭️  通知対象: NO（既に予想済み）`);
      } else if (alreadyNotified) {
        console.log(`   ⏭️  通知対象: NO（既に通知送信済み）`);
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
