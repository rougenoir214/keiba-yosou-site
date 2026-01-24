// プッシュ通知管理スクリプト
let pushNotificationEnabled = false;

// Base64をUint8Arrayに変換するヘルパー関数
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// プッシュ通知の購読を登録
async function subscribeToPushNotifications() {
  try {
    // Service Workerの登録を確認
    const registration = await navigator.serviceWorker.ready;
    
    // 既存の購読を確認
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // 新しい購読を作成
      const vapidPublicKey = document.getElementById('vapid-public-key')?.value;
      if (!vapidPublicKey) {
        console.error('VAPID公開キーが見つかりません');
        return false;
      }

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
    }

    // サーバーに購読情報を送信
    console.log('購読情報をサーバーに送信中...', subscription);
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscription)
    });

    console.log('サーバーレスポンス:', response.status);
    const data = await response.json();
    console.log('レスポンスデータ:', data);

    if (response.ok) {
      pushNotificationEnabled = true;
      updatePushNotificationUI(true);
      console.log('✅ プッシュ通知の購読に成功しました');
      alert('✅ プッシュ通知を有効にしました');
      return true;
    } else {
      console.error('❌ 購読情報の保存に失敗しました:', data);
      alert('❌ 購読情報の保存に失敗しました: ' + (data.error || '不明なエラー'));
      return false;
    }
  } catch (error) {
    console.error('プッシュ通知の購読エラー:', error);
    return false;
  }
}

// プッシュ通知の購読を解除
async function unsubscribeFromPushNotifications() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      
      // サーバーから購読情報を削除
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
      
      pushNotificationEnabled = false;
      updatePushNotificationUI(false);
      console.log('プッシュ通知の購読を解除しました');
      return true;
    }
  } catch (error) {
    console.error('購読解除エラー:', error);
    return false;
  }
}

// UI更新
function updatePushNotificationUI(enabled) {
  const enableBtn = document.getElementById('enable-push-btn');
  const disableBtn = document.getElementById('disable-push-btn');
  const statusText = document.getElementById('push-status');
  
  if (enableBtn && disableBtn) {
    if (enabled) {
      enableBtn.style.display = 'none';
      disableBtn.style.display = 'inline-block';
      if (statusText) statusText.textContent = '有効';
    } else {
      enableBtn.style.display = 'inline-block';
      disableBtn.style.display = 'none';
      if (statusText) statusText.textContent = '無効';
    }
  }
}

// プッシュ通知のサポート確認と初期化
async function initPushNotifications() {
  console.log('🔔 プッシュ通知の初期化を開始...');
  console.log('User Agent:', navigator.userAgent);
  console.log('Service Worker サポート:', 'serviceWorker' in navigator);
  console.log('Push API サポート:', 'PushManager' in window);
  console.log('Notification API サポート:', 'Notification' in window);
  
  // プッシュ通知のサポート確認
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('❌ このブラウザはプッシュ通知をサポートしていません');
    const statusText = document.getElementById('push-status');
    if (statusText) {
      statusText.textContent = 'サポート外';
      statusText.style.color = '#f44336';
    }
    // ボタンを非表示
    const enableBtn = document.getElementById('enable-push-btn');
    if (enableBtn) enableBtn.style.display = 'none';
    return;
  }

  // VAPIDキーの存在確認
  const vapidKeyElement = document.getElementById('vapid-public-key');
  const vapidKey = vapidKeyElement?.value;
  console.log('VAPID公開キー要素:', vapidKeyElement ? '存在する' : '存在しない');
  console.log('VAPID公開キーの値:', vapidKey ? `${vapidKey.substring(0, 20)}... (長さ: ${vapidKey.length})` : '空');
  
  if (!vapidKey || vapidKey.length === 0) {
    console.error('❌ VAPID公開キーが設定されていません');
    const statusText = document.getElementById('push-status');
    if (statusText) {
      statusText.textContent = '設定エラー';
      statusText.style.color = '#f44336';
    }
    return;
  }

  try {
    console.log('⏳ Service Workerの準備を待機中...');
    // 現在の購読状態を確認
    const registration = await navigator.serviceWorker.ready;
    console.log('✅ Service Worker準備完了:', registration.active ? 'アクティブ' : '待機中');
    
    const subscription = await registration.pushManager.getSubscription();
    console.log('購読状態:', subscription ? '購読済み' : '未購読');
    if (subscription) {
      console.log('購読エンドポイント:', subscription.endpoint.substring(0, 50) + '...');
    }
    
    pushNotificationEnabled = !!subscription;
    updatePushNotificationUI(pushNotificationEnabled);
    console.log('✅ プッシュ通知の初期化完了');
  } catch (error) {
    console.error('❌ プッシュ通知の初期化エラー:', error);
    console.error('エラー詳細:', error.message, error.stack);
    const statusText = document.getElementById('push-status');
    if (statusText) {
      statusText.textContent = 'エラー';
      statusText.style.color = '#f44336';
    }
  }
}

// プッシュ通知の許可をリクエスト
async function requestPushNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('通知の許可が得られました');
      return await subscribeToPushNotifications();
    } else if (permission === 'denied') {
      alert('通知が拒否されました。ブラウザの設定から通知を許可してください。');
      return false;
    } else {
      console.log('通知の許可が保留されました');
      return false;
    }
  } catch (error) {
    console.error('通知許可のリクエストエラー:', error);
    return false;
  }
}

// ページ読み込み時に初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPushNotifications);
} else {
  initPushNotifications();
}
