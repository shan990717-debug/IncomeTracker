// Minimal service worker: makes the app installable (and a share target on Android).
// Network-first passthrough; no offline caching yet.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
