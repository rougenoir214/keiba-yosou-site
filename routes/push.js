const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const webpush = require('web-push');

// 環境変数からVAPIDキーを読み込み
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@keiba-yosou.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );
}

// プッシュ通知の購読を保存
router.post('/subscribe', async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const { endpoint, keys } = req.body;
    
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: '無効な購読データです' });
    }

    // 既存の購読をチェック
    const checkQuery = `
      SELECT id FROM push_subscriptions 
      WHERE user_id = $1 AND endpoint = $2
    `;
    const existing = await db.query(checkQuery, [req.session.user.id, endpoint]);

    if (existing.rows.length > 0) {
      // 既存の購読を更新
      const updateQuery = `
        UPDATE push_subscriptions 
        SET keys_p256dh = $1, keys_auth = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `;
      await db.query(updateQuery, [keys.p256dh, keys.auth, existing.rows[0].id]);
    } else {
      // 新しい購読を挿入
      const insertQuery = `
        INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
        VALUES ($1, $2, $3, $4)
      `;
      await db.query(insertQuery, [req.session.user.id, endpoint, keys.p256dh, keys.auth]);
    }

    res.json({ success: true, message: 'プッシュ通知の購読を保存しました' });
  } catch (error) {
    console.error('購読保存エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// プッシュ通知の購読を解除
router.post('/unsubscribe', async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ error: 'エンドポイントが必要です' });
    }

    const deleteQuery = `
      DELETE FROM push_subscriptions 
      WHERE user_id = $1 AND endpoint = $2
    `;
    await db.query(deleteQuery, [req.session.user.id, endpoint]);

    res.json({ success: true, message: 'プッシュ通知の購読を解除しました' });
  } catch (error) {
    console.error('購読解除エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// テスト用: プッシュ通知を送信（開発時のみ）
router.post('/test-send', async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    // ユーザーの購読情報を取得
    const query = `
      SELECT endpoint, keys_p256dh, keys_auth 
      FROM push_subscriptions 
      WHERE user_id = $1
    `;
    const result = await db.query(query, [req.session.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'プッシュ通知の購読が見つかりません' });
    }

    const payload = JSON.stringify({
      title: 'テスト通知',
      body: 'これはテスト通知です',
      icon: '/icons/icon-192.png',
      url: '/races'
    });

    // 各購読先に通知を送信
    const sendPromises = result.rows.map(row => {
      const pushSubscription = {
        endpoint: row.endpoint,
        keys: {
          p256dh: row.keys_p256dh,
          auth: row.keys_auth
        }
      };
      return webpush.sendNotification(pushSubscription, payload);
    });

    await Promise.all(sendPromises);

    res.json({ success: true, message: `${result.rows.length}件の通知を送信しました` });
  } catch (error) {
    console.error('テスト通知送信エラー:', error);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

module.exports = router;
