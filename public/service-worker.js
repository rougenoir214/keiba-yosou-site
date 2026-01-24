const CACHE_NAME = 'keiba-yosou-v3';
const urlsToCache = [
  '/races',
  '/css/style.css',
  '/css/betting-ticket-styles.css',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('キャッシュをオープンしました');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.log('キャッシュエラー:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('古いキャッシュを削除:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  // ルートパスはキャッシュしない
  if (event.request.url.endsWith('/') && !event.request.url.includes('/races')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // POSTリクエストはキャッシュしない
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // GETリクエストのみキャッシュ
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// プッシュ通知を受信したときの処理
self.addEventListener('push', event => {
  console.log('プッシュ通知を受信しました:', event);
  
  let data = {
    title: '競馬予想サイト',
    body: '新しい通知があります',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'race-notification',
    requireInteraction: false
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      console.error('プッシュデータのパースエラー:', e);
      data.body = event.data.text();
    }
  }

  const notificationPromise = self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    requireInteraction: data.requireInteraction,
    data: {
      url: data.url || '/races'
    }
  });

  event.waitUntil(notificationPromise);
});

// 通知をクリックしたときの処理
self.addEventListener('notificationclick', event => {
  console.log('通知がクリックされました:', event);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/races';

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  })
  .then(windowClients => {
    // 既に開いているウィンドウがあればそれにフォーカス
    for (let client of windowClients) {
      if (client.url.includes(urlToOpen) && 'focus' in client) {
        return client.focus();
      }
    }
    // なければ新しいウィンドウを開く
    if (clients.openWindow) {
      return clients.openWindow(urlToOpen);
    }
  });

  event.waitUntil(promiseChain);
});
