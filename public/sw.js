// Minimal service worker: makes the app installable. Push + check-in buttons arrive in slice 2.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
