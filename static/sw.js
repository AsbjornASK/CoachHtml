// Service worker: shows the morning push and opens its page when tapped. No caching.
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
    const win = list.find(c => 'focus' in c);
    if (win) return (win.navigate ? win.navigate(url) : Promise.resolve()).then(() => win.focus());
    return clients.openWindow(url);
  }));
});
