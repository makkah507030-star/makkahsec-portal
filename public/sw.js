/* ===================================================================
   Service Worker — إشعارات الجوال (Web Push) لبوابة مكة الثانوية الرقمية
   يستقبل الإشعار المدفوع ويعرضه على شاشة الجوال، ويفتح البوابة عند الضغط.
   =================================================================== */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "بوابة مكة الثانوية", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "بوابة مكة الثانوية الرقمية";
  const options = {
    body: data.body || "",
    icon: "/android-chrome-192x192.png",
    badge: "/favicon-32x32.png",
    image: data.image || undefined, // صورة كبيرة داخل الإشعار (أندرويد)
    lang: "ar",
    dir: "rtl",
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) {
            client.navigate(url).catch(() => {});
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
