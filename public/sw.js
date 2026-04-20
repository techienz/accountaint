// Accountaint service worker — handles incoming web-push notifications.

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Accountaint", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Accountaint";
  const options = {
    body: data.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing window if there is one
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        // Otherwise open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});
