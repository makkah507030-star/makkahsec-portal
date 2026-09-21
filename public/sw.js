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
  const target = new URL(url, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // نافذة مفتوحة بالفعل على نفس صفحة الإشعار → نُركّز عليها فقط
      for (const client of list) {
        if (client.url === target && "focus" in client) {
          return client.focus();
        }
      }

      // نافذة مفتوحة على صفحة أخرى → نُوجّهها لصفحة الإشعار ثم نُركّز
      // (بعض المتصفحات تمنع navigate على نافذة غير خاضعة للتحكم، فنفتح نافذة جديدة عندها)
      for (const client of list) {
        if ("focus" in client) {
          try {
            await client.navigate(target);
            return await client.focus();
          } catch (e) {
            /* navigate ممنوع هنا — نُكمل لفتح نافذة جديدة */
          }
        }
      }

      // لا نافذة مفتوحة → نفتح نافذة جديدة مباشرة على صفحة الإشعار
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })()
  );
});
