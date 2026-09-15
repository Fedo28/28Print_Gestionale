self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {};
    }
  }

  const title = payload.title || "28Print";
  const options = {
    badge: "/shop/stampa-documenti-illustration.png",
    body: payload.body || "Nuovo ordine da controllare.",
    data: {
      href: payload.href || "/orders"
    },
    icon: "/shop/stampa-documenti-illustration.png",
    renotify: true,
    requireInteraction: true,
    tag: payload.tag || "28print-order-notification",
    vibrate: [120, 60, 120]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const href = event.notification.data && event.notification.data.href
    ? event.notification.data.href
    : "/orders";
  const targetUrl = new URL(href, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clientList) => {
      const sameOriginClient = clientList.find((client) => client.url.startsWith(self.location.origin));

      if (sameOriginClient) {
        if ("navigate" in sameOriginClient) {
          sameOriginClient.navigate(targetUrl);
        }

        return sameOriginClient.focus();
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
