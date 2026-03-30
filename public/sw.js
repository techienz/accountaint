self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Accountaint";
  const options = {
    body: data.body || "",
    icon: "/favicon.ico",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
