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
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscription)
    });

    if (response.ok) {
      pushNotificationEnabled = true;
      updatePushNotificationUI(true);
      console.log('プッシュ通知の購読に成功しました');
      return true;
    } else {
      console.error('購読情報の保存に失敗しました');
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
  // プッシュ通知のサポート確認
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('このブラウザはプッシュ通知をサポートしていません');
    return;
  }

  try {
    // 現在の購読状態を確認
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    pushNotificationEnabled = !!subscription;
    updatePushNotificationUI(pushNotificationEnabled);
  } catch (error) {
    console.error('プッシュ通知の初期化エラー:', error);
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
