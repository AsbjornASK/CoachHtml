// Service worker: shows the morning push and opens its page when tapped. No caching.
// Take control at once: iOS Home Screen apps rarely close every window, so a waiting update would never activate.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(clients.claim()));

self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = {}; }
  event.waitUntil(self.registration.showNotification(d.title || 'Coach', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const win = list.find(c => 'focus' in c && 'navigate' in c);
    if (!win) return clients.openWindow(url);
    // navigate() rejects for a window this worker doesn't control yet
    return win.navigate(url).then(() => win.focus()).catch(() => clients.openWindow(url));
  }));
});
