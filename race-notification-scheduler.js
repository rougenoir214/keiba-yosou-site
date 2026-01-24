// レース発走時刻チェックとプッシュ通知送信のスケジューラー（1日1回督促通知版）
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

// その日の最初のレースの30分前に、まだ予想していないユーザーに通知
async function checkAndNotifyDailyReminder() {
  try {
    console.log('⏰ 本日のレース予想締切チェック開始:', new Date().toLocaleString('ja-JP'));

    // 今日の最初のレース（最も早い発走時刻）の30分前（±2分の誤差を許容）かチェック
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
      console.log('📭 本日のレースはありません');
      return;
    }

    const firstRace = firstRaceResult.rows[0];
    const minutesUntil = Math.round(firstRace.minutes_until);

    console.log(`📋 本日の最初のレース: ${firstRace.race_name} (${firstRace.race_time})`);
    console.log(`⏱️  発走まで: ${minutesUntil}分`);

    // 30分前（28〜32分の範囲）かチェック
    if (minutesUntil < 28 || minutesUntil > 32) {
      console.log(`⏳ まだ通知タイミングではありません（30分前ではない: ${minutesUntil}分前）`);
      return;
    }

    console.log('🎯 本日の最初のレースの30分前です！督促通知を送信します');

    // まだ今日予想していないユーザーに通知
    await sendDailyReminderNotifications(firstRace);

    console.log('✅ 本日のレース予想締切チェック完了\n');
  } catch (error) {
    console.error('❌ 本日のレース予想締切チェックエラー:', error);
  }
}

// 本日まだ予想していないユーザーに督促通知を送信
async function sendDailyReminderNotifications(firstRace) {
  try {
    console.log(`\n🔔 督促通知の送信を開始...`);

    // プッシュ通知が有効なユーザーを全員取得
    const allUsersQuery = `
      SELECT DISTINCT ps.user_id, u.display_name
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.id
    `;
    
    const allUsersResult = await db.query(allUsersQuery);
    
    if (allUsersResult.rows.length === 0) {
      console.log('   ℹ️  プッシュ通知を登録しているユーザーがいません');
      return;
    }

    console.log(`   👥 プッシュ通知登録者: ${allUsersResult.rows.length}名`);

    // まだ今日予想していないユーザーをフィルタリング
    const usersToNotify = [];
    
    for (const user of allUsersResult.rows) {
      // 今日既に予想しているかチェック
      const predictionCheckQuery = `
        SELECT COUNT(*) as prediction_count
        FROM predictions p
        JOIN races r ON p.race_id = r.race_id
        WHERE p.user_id = $1 AND r.race_date = CURRENT_DATE
      `;
      
      const predictionResult = await db.query(predictionCheckQuery, [user.user_id]);
      const hasPrediction = predictionResult.rows[0].prediction_count > 0;

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

      if (!hasPrediction && !alreadyNotified) {
        usersToNotify.push(user);
      }
    }

    if (usersToNotify.length === 0) {
      console.log('   ℹ️  通知対象のユーザーはいません（全員予想済みまたは送信済み）');
      return;
    }

    console.log(`   📬 通知対象: ${usersToNotify.length}名（まだ予想していないユーザー）`);

    // 各ユーザーに督促通知を送信
    let successCount = 0;
    let failCount = 0;

    for (const user of usersToNotify) {
      const sent = await sendReminderPushToUser(user.user_id, firstRace);
      if (sent) {
        successCount++;
        // 送信履歴を記録（race_idとして最初のレースのIDを使用）
        await recordNotification(firstRace.race_id, user.user_id, 'daily_reminder');
      } else {
        failCount++;
      }
    }

    console.log(`   ✅ 送信完了: 成功 ${successCount}件 / 失敗 ${failCount}件`);
  } catch (error) {
    console.error(`❌ 督促通知送信エラー:`, error.message);
  }
}

// ユーザーに督促プッシュ通知を送信
async function sendReminderPushToUser(userId, firstRace) {
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
      title: '🏇 本日のレース予想締切まもなく',
      body: `まだ予想を投稿していません。${firstRace.race_name}の発走前に予想しましょう！`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `daily-reminder-${firstRace.race_date}`,
      requireInteraction: true,
      data: {
        url: '/races',
        type: 'daily_reminder',
        raceDate: firstRace.race_date
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
  console.log('🚀 レース予想締切通知スケジューラーを起動します...');
  console.log(`📍 環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ チェック間隔: 1分ごと`);
  console.log(`📋 通知内容: その日の最初のレース30分前に、まだ予想していない人に督促\n`);

  // 1分ごとに実行（毎分0秒に実行）
  const job = schedule.scheduleJob('0 * * * * *', checkAndNotifyDailyReminder);

  if (job) {
    console.log('✅ スケジューラーが正常に起動しました');
    console.log('   次回実行:', job.nextInvocation().toString(), '\n');
  } else {
    console.error('❌ スケジューラーの起動に失敗しました');
  }

  // 起動時に1回実行（テスト用）
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧪 開発環境: 起動時にチェックを実行します\n');
    setTimeout(checkAndNotifyDailyReminder, 3000);
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
