/* ===================================================================
   إشعارات الجوال (Web Push) — أدوات الواجهة
   تسجيل Service Worker، طلب الإذن، الاشتراك/إلغاؤه، وحفظه في Supabase.
   =================================================================== */
import { supabase } from "./supabase";

// مفتاح VAPID العام (آمن للنشر في الواجهة) — يقابله المفتاح الخاص في خادم Netlify
const VAPID_PUBLIC_KEY =
  "BKCf0gEvad54a5CcDGa-YXguD7Od_RvFDHUo_k5-NcnxpKFGpAOglPLGGnbwBlUodxrhbGzIGE9S-iOl__djuNc";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// آيفون/آيباد: الدفع لا يعمل إلا بعد «إضافة إلى الشاشة الرئيسية» (تشغيل كتطبيق مثبّت)
export function isIosNeedsInstall() {
  const ua = navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;
  return isIos && !standalone;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

// الحالة الحالية: granted | denied | default | unsupported، مع وجود اشتراك فعّال
export async function pushState() {
  if (!pushSupported()) return { supported: false, permission: "unsupported", subscribed: false };
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    subscribed = !!sub;
  } catch {
    /* تجاهل */
  }
  return { supported: true, permission: Notification.permission, subscribed };
}

// تفعيل الإشعارات: يطلب الإذن، يشترك، ويحفظ الاشتراك للمستخدم الحالي
export async function enablePush() {
  if (!pushSupported()) throw new Error("جهازك أو متصفّحك لا يدعم الإشعارات.");

  const { data: sess } = await supabase.auth.getUser();
  const userId = sess?.user?.id;
  if (!userId) throw new Error("سجّل الدخول أولًا.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("لم يتم السماح بالإشعارات.");

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;

  return true;
}

// إلغاء الإشعارات لهذا الجهاز
export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    try {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    } catch {
      /* تجاهل */
    }
    await sub.unsubscribe().catch(() => {});
  }
}
