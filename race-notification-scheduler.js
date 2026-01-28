// レース予想締切通知スケジューラー（1日1回、15時実行版）
require('dotenv').config();
const schedule = require('node-schedule');
const db = require('./db/connection');
const { queryWithRetry } = require('./db/connection');
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

// 毎日15時にその日のレースをチェックして通知
async function checkAndNotifyDailyReminder() {
  try {
    const now = new Date();
    console.log('⏰ レース予想締切通知チェック開始:', now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));

    // 今日のレースを取得
    const todayRacesQuery = `
      SELECT 
        r.id as race_id,
        r.race_name,
        r.race_date,
        r.race_time
      FROM races r
      WHERE r.race_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date
      ORDER BY r.race_time ASC
    `;
    
    const racesResult = await queryWithRetry(todayRacesQuery);
    
    if (racesResult.rows.length === 0) {
      console.log('📭 本日のレースはありません - 通知スキップ');
      return;
    }

    console.log(`📋 本日のレース数: ${racesResult.rows.length}件`);
    
    // 今日まだ通知を送っていないユーザーを取得
    const usersToNotifyQuery = `
      SELECT DISTINCT ps.user_id, u.display_name
      FROM push_subscriptions ps
      JOIN users u ON ps.user_id = u.id
      LEFT JOIN race_notifications rn ON rn.user_id = ps.user_id
        AND rn.notification_type = 'daily_reminder'
        AND DATE(rn.sent_at AT TIME ZONE 'Asia/Tokyo') = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date
      WHERE rn.id IS NULL
    `;
    
    const usersResult = await queryWithRetry(usersToNotifyQuery);
    
    if (usersResult.rows.length === 0) {
      console.log('✅ 全ユーザーに通知済みです');
      return;
    }

    console.log(`📤 通知対象ユーザー: ${usersResult.rows.length}人`);
    
    // 各ユーザーに通知を送信
    let successCount = 0;
    let failCount = 0;
    
    for (const user of usersResult.rows) {
      try {
        // ユーザーのプッシュ購読情報を取得
        const subscriptionsQuery = `
          SELECT endpoint, p256dh_key, auth_key
          FROM push_subscriptions
          WHERE user_id = $1
        `;
        const subsResult = await queryWithRetry(subscriptionsQuery, [user.user_id]);
        
        if (subsResult.rows.length === 0) {
          console.log(`⚠️ ${user.display_name} の購読情報が見つかりません`);
          continue;
        }

        // 通知内容
        const payload = JSON.stringify({
          title: '🏇 本日のレース予想締切のお知らせ',
          body: `本日は${racesResult.rows.length}レース開催されます。予想をお忘れなく！`,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          data: {
            url: '/races'
          }
        });

        // 各購読に対して通知を送信
        for (const subscription of subsResult.rows) {
          try {
            const pushSubscription = {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh_key,
                auth: subscription.auth_key
              }
            };

            await webpush.sendNotification(pushSubscription, payload);
          } catch (pushError) {
            console.error(`プッシュ通知送信エラー (${user.display_name}):`, pushError.message);
          }
        }

        // 通知履歴を記録
        await recordNotificationHistory(user.user_id, 'daily_reminder');
        
        successCount++;
        console.log(`✅ 通知送信成功: ${user.display_name}`);
        
      } catch (userError) {
        failCount++;
        console.error(`❌ ユーザー通知処理エラー (${user.display_name}):`, userError.message);
      }
    }
    
    console.log(`\n📊 通知送信完了: 成功 ${successCount}件 / 失敗 ${failCount}件\n`);
    
  } catch (error) {
    console.error('❌ レース予想締切チェックエラー:', error.message);
  }
}

// 通知履歴を記録
async function recordNotificationHistory(userId, notificationType) {
  try {
    await queryWithRetry(
      `INSERT INTO race_notifications (user_id, notification_type, sent_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')`,
      [userId, notificationType]
    );
  } catch (error) {
    console.error('通知履歴の記録エラー:', error.message);
  }
}

// スケジューラーの起動
function startScheduler() {
  console.log('🚀 レース予想締切通知スケジューラーを起動します...');
  console.log(`📍 環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ 実行時刻: 毎日15:00（JST）`);
  console.log(`📋 通知内容: その日のレース開催を全ユーザーへリマインダー（1日1回）\n`);

  // 毎日15時（JST）= UTC 6時に実行
  // Cron形式: 分 時 日 月 曜日
  // '0 6 * * *' = 毎日UTC 6時 = JST 15時
  const job = schedule.scheduleJob('0 6 * * *', checkAndNotifyDailyReminder);

  if (job) {
    console.log('✅ スケジューラーが正常に起動しました');
    console.log('   次回実行:', job.nextInvocation().toString(), '\n');
  } else {
    console.error('❌ スケジューラーの起動に失敗しました');
  }

  // 開発環境では起動時に1回実行（テスト用）
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧪 開発環境: 起動時にチェックを実行します\n');
    setTimeout(checkAndNotifyDailyReminder, 3000);
  }
}

// エクスポート
module.exports = {
  startScheduler,
  checkAndNotifyDailyReminder
};
