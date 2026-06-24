// Minimal service worker for admin alert notifications.
// No caching — this only exists so showNotification() works in Chrome
// when the tab is backgrounded or minimised.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Handle notification clicks — bring the admin tab into focus.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            return client.focus();
          }
        }
        // No open window found — open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow("/");
        }
      }),
  );
});
