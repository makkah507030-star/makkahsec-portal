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

      // نافذة مفتوحة بالفعل (حتى لو في الخلفية) → نُركّز عليها ونطلب من التطبيق
      // التنقّل داخليًا عبر رسالة — أضمن من client.navigate الذي تمنعه بعض
      // المتصفحات، وبلا إعادة تحميل فتبقى الجلسة محفوظة.
      for (const client of list) {
        if ("focus" in client) {
          try { await client.focus(); } catch (e) { /* تجاهل */ }
          client.postMessage({ type: "OPEN_URL", url });
          return;
        }
      }

      // لا نافذة مفتوحة → نفتح نافذة جديدة مباشرة على صفحة الإشعار
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })()
  );
});

/* ===================================================================
   الاختبار دون إنترنت (src/lib/offlineQuiz.js): صفحة الاختبار محفوظة على جوال الطالب
   بعد تنزيله. تُعرض على /offline-quiz دائمًا، وبدل أي صفحة من البوابة تعذّر فتحها
   لانقطاع الإنترنت. ما عدا ذلك يمرّ إلى الشبكة كما هو.
   =================================================================== */
const OQ_CACHE = "mk-offline-quiz";
const OQ_PAGE = "/offline-quiz";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate" || req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const cached = () => caches.open(OQ_CACHE).then((c) => c.match(OQ_PAGE));
  if (url.pathname === OQ_PAGE) {
    event.respondWith(cached().then((r) => r || fetch(req)));
    return;
  }
  event.respondWith(fetch(req).catch(() => cached().then((r) => r || Response.error())));
});
