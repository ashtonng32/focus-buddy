// Focus Buddy service worker: shows the check-in notification and answers its buttons.
const ACTIONS = [
  { action: "keep_going", title: "Keep going" },
  { action: "done", title: "Done" },
  { action: "stuck", title: "I'm stuck" },
];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  // Android Chrome shows at most 2 buttons (Notification.maxActions). Keep going and Done win;
  // "I'm stuck" is one tap away on the check-in screen the notification opens.
  const max = typeof Notification.maxActions === "number" ? Notification.maxActions : 2;
  const actions = data.kind === "focus" ? ACTIONS.slice(0, max) : [];
  event.waitUntil(
    self.registration.showNotification(data.title || "Check-in", {
      body: data.body || "",
      tag: data.sessionId || "checkin",
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      actions,
      data: { sessionId: data.sessionId },
    }),
  );
});

async function openApp() {
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of all) {
    if ("focus" in c) {
      await c.focus();
      c.postMessage({ type: "refresh" });
      return;
    }
  }
  await self.clients.openWindow("/");
}

async function refreshOpenApps() {
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  all.forEach((c) => c.postMessage({ type: "refresh" }));
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { action } = event;
  const sessionId = event.notification.data && event.notification.data.sessionId;

  if (action !== "keep_going" && action !== "done" && action !== "stuck") {
    // Tapped the body: open the app, which shows the check-in.
    event.waitUntil(openApp());
    return;
  }

  event.waitUntil(
    fetch("/api/checkin", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action }),
    })
      .then((res) => (res.ok && action !== "stuck" ? refreshOpenApps() : openApp()))
      .catch(() => openApp()),
  );
});
