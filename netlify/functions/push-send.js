// =====================================================================
//  بوابة مكة الثانوية الرقمية
//  Netlify Function: push-send — إرسال إشعار الجوال (Web Push) لمستلمي إشعار
//
//  المُدخل (POST JSON): { notification_id?: uuid }
//    - يقرأ عنوان/نص الإشعار من جدول notifications
//    - يقرأ المستلمين من notification_recipients
//    - يرسل Web Push لكل اشتراكات هؤلاء المستخدمين في push_subscriptions
//    - يحذف الاشتراكات المنتهية (404/410)
//
//  متغيّرات البيئة المطلوبة في Netlify:
//    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:info@makkahsec.com)
// =====================================================================

const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

const json = (body, status = 200) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json({ error: "method not allowed" }, 405);

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:info@makkahsec.com";

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: "VAPID keys not configured" }, 500);
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json({ error: "bad json" }, 400);
  }

  try {
    // ---------- تحديد الإشعار ----------
    let notifId = payload.notification_id;
    // احتياط: إن لم يصل معرّف صالح، نأخذ أحدث إشعار خلال آخر دقيقتين
    const isUuid =
      typeof notifId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(notifId);
    if (!isUuid) {
      const since = new Date(Date.now() - 120000).toISOString();
      const { data: latest } = await admin
        .from("notifications")
        .select("id")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      notifId = latest?.id;
    }
    if (!notifId) return json({ sent: 0, reason: "no notification" });

    const { data: notif } = await admin
      .from("notifications")
      .select("id, title, body, image_url")
      .eq("id", notifId)
      .maybeSingle();
    if (!notif) return json({ sent: 0, reason: "notification not found" });

    // ---------- المستلمون ----------
    const recIds = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data: recs, error } = await admin
        .from("notification_recipients")
        .select("user_id")
        .eq("notification_id", notifId)
        .range(from, from + pageSize - 1);
      if (error) return json({ error: "recipients: " + error.message }, 500);
      (recs || []).forEach((r) => r.user_id && recIds.push(r.user_id));
      if (!recs || recs.length < pageSize) break;
    }
    if (!recIds.length) return json({ sent: 0, reason: "no recipients" });

    // ---------- اشتراكات الدفع لهؤلاء المستخدمين ----------
    const subs = [];
    const chunk = (a, n) => {
      const o = [];
      for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n));
      return o;
    };
    for (const part of chunk([...new Set(recIds)], 300)) {
      const { data: rows } = await admin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .in("user_id", part);
      (rows || []).forEach((s) => subs.push(s));
    }
    if (!subs.length) return json({ sent: 0, reason: "no subscriptions" });

    // ---------- الإرسال ----------
    const message = JSON.stringify({
      title: notif.title || "بوابة مكة الثانوية الرقمية",
      body: notif.body || "",
      image: notif.image_url || undefined,
      url: "/notify/" + notif.id, // فتح صفحة عرض الإشعار عند الضغط
      tag: "notif-" + notif.id,
    });

    let sent = 0;
    const stale = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            message
          );
          sent++;
        } catch (e) {
          const code = e?.statusCode;
          if (code === 404 || code === 410) stale.push(s.endpoint);
        }
      })
    );

    // تنظيف الاشتراكات المنتهية
    if (stale.length) {
      await admin.from("push_subscriptions").delete().in("endpoint", stale);
    }

    return json({ sent, total: subs.length, removed: stale.length });
  } catch (e) {
    console.error("push-send error:", e);
    return json({ error: String(e) }, 500);
  }
};
