// Self-unregistering service worker.
// A previous build registered a service worker that no longer exists.
// This file ensures the stale worker is cleanly removed.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => {
  self.registration.unregister();
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    clients.forEach((client) => client.navigate(client.url));
  });
});
