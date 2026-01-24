// レース発走時刻チェックとプッシュ通知送信のスケジューラー
require('dotenv').config();
const schedule = require('node-schedule');
const db = require('./db/connection');
const webpush = require('web-push');

// 環境変数からVAPIDキーを読み込み
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@keiba-yosou.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  console.log('✅ Web Push VAPIDキー設定完了');
} else {
  console.error('❌ VAPIDキーが設定されていません');
}

// 発走30分前のレースを検出して通知を送信
async function checkAndNotifyRaces() {
  try {
    console.log('⏰ レース発走時刻チェック開始:', new Date().toLocaleString('ja-JP'));

    // 現在時刻から30分後（±2分の誤差を許容）のレースを取得
    const query = `
      SELECT 
        r.id as race_id,
        r.race_name,
        r.race_date,
        r.race_time
      FROM races r
      WHERE r.race_date = CURRENT_DATE
        AND CAST(r.race_time AS TIME) BETWEEN 
          (CURRENT_TIME::TIME + INTERVAL '28 minutes') 
          AND (CURRENT_TIME::TIME + INTERVAL '32 minutes')
      ORDER BY r.race_time
    `;
    
    const racesResult = await db.query(query);
    
    if (racesResult.rows.length === 0) {
      console.log('📭 通知対象のレースはありません');
      return;
    }

    console.log(`📬 ${racesResult.rows.length}件のレースが30分前です`);

    for (const race of racesResult.rows) {
      await sendRaceNotifications(race);
    }

    console.log('✅ レース発走時刻チェック完了\n');
  } catch (error) {
    console.error('❌ レース発走時刻チェックエラー:', error);
  }
}

// 特定のレースについて通知を送信
async function sendRaceNotifications(race) {
  try {
    console.log(`\n🏇 レース: ${race.race_name} (ID: ${race.race_id})`);
    console.log(`   発走時刻: ${race.race_time}`);

    // このレースに予想を投稿したユーザーを取得
    // 既に通知を送信済みのユーザーは除外
    const usersQuery = `
      SELECT DISTINCT 
        p.user_id,
        u.display_name
      FROM predictions p
      JOIN users u ON p.user_id = u.id
      WHERE p.race_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM race_notifications rn
          WHERE rn.race_id = p.race_id
            AND rn.user_id = p.user_id
            AND rn.notification_type = '30min_before'
        )
    `;
    
    const usersResult = await db.query(usersQuery, [race.race_id]);
    
    if (usersResult.rows.length === 0) {
      console.log('   ℹ️  通知対象のユーザーはいません（全員送信済みまたは予想なし）');
      return;
    }

    console.log(`   👥 ${usersResult.rows.length}名のユーザーに通知します`);

    // 各ユーザーにプッシュ通知を送信
    let successCount = 0;
    let failCount = 0;

    for (const user of usersResult.rows) {
      const sent = await sendPushToUser(user.user_id, race);
      if (sent) {
        successCount++;
        // 送信履歴を記録
        await recordNotification(race.race_id, user.user_id, '30min_before');
      } else {
        failCount++;
      }
    }

    console.log(`   ✅ 送信完了: 成功 ${successCount}件 / 失敗 ${failCount}件`);
  } catch (error) {
    console.error(`❌ レース通知送信エラー (ID: ${race.race_id}):`, error.message);
  }
}

// ユーザーにプッシュ通知を送信
async function sendPushToUser(userId, race) {
  try {
    // ユーザーのプッシュ購読情報を取得
    const subsQuery = `
      SELECT endpoint, keys_p256dh, keys_auth
      FROM push_subscriptions
      WHERE user_id = $1
    `;
    
    const subsResult = await db.query(subsQuery, [userId]);
    
    if (subsResult.rows.length === 0) {
      console.log(`   ⚠️  ユーザーID ${userId}: プッシュ通知未登録`);
      return false;
    }

    // 通知ペイロードを作成
    const payload = JSON.stringify({
      title: '🏇 レース発走30分前',
      body: `${race.race_name} がまもなく発走します`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `race-${race.race_id}`,
      requireInteraction: false,
      data: {
        url: `/races/${race.race_id}`,
        raceId: race.race_id,
        raceName: race.race_name
      }
    });

    // 各購読先に送信
    const sendPromises = subsResult.rows.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
        return true;
      } catch (error) {
        // 購読が無効な場合は削除
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`   🗑️  無効な購読を削除: ${sub.endpoint.substring(0, 30)}...`);
          await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
        } else {
          console.error(`   ❌ 送信エラー: ${error.message}`);
        }
        return false;
      }
    });

    const results = await Promise.all(sendPromises);
    const success = results.some(r => r === true);
    
    if (success) {
      console.log(`   ✉️  ユーザーID ${userId}: 送信成功`);
    }
    
    return success;
  } catch (error) {
    console.error(`   ❌ ユーザーID ${userId} への送信エラー:`, error.message);
    return false;
  }
}

// 通知送信履歴を記録
async function recordNotification(raceId, userId, notificationType) {
  try {
    await db.query(
      `INSERT INTO race_notifications (race_id, user_id, notification_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (race_id, user_id, notification_type) DO NOTHING`,
      [raceId, userId, notificationType]
    );
  } catch (error) {
    console.error('通知履歴の記録エラー:', error.message);
  }
}

// スケジューラーの起動
function startScheduler() {
  console.log('🚀 レース通知スケジューラーを起動します...');
  console.log(`📍 環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ チェック間隔: 1分ごと\n`);

  // 1分ごとに実行（毎分0秒に実行）
  const job = schedule.scheduleJob('0 * * * * *', checkAndNotifyRaces);

  if (job) {
    console.log('✅ スケジューラーが正常に起動しました');
    console.log('   次回実行:', job.nextInvocation().toString(), '\n');
  } else {
    console.error('❌ スケジューラーの起動に失敗しました');
  }

  // 起動時に1回実行（テスト用）
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧪 開発環境: 起動時にチェックを実行します\n');
    setTimeout(checkAndNotifyRaces, 3000);
  }
}

// プロセス終了時のクリーンアップ
process.on('SIGTERM', () => {
  console.log('\n⏹️  SIGTERM受信: スケジューラーを停止します');
  schedule.gracefulShutdown().then(() => {
    console.log('✅ スケジューラーを正常に停止しました');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⏹️  SIGINT受信: スケジューラーを停止します');
  schedule.gracefulShutdown().then(() => {
    console.log('✅ スケジューラーを正常に停止しました');
    process.exit(0);
  });
});

// スケジューラー起動
startScheduler();
