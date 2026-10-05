// src/lib/notice.js
// =====================================================================
//  مخزن التنبيهات ونشاط الشبكة — بلا React، فيُستورد من أي مكان
//  (ومنه عميل Supabase نفسه).
//
//  • notify(): نتيجة إجراء (نجاح أو خطأ) تظهر في صندوق وسط الشاشة.
//  • loaderMounted(): جزء من الصفحة يُحمَّل — يحجب الصفحة بتضليل خفيف.
//  • trackedFetch: يغلّف طلبات Supabase ليعرف متى يجري «تنفيذ» بدأه المستخدم
//    (حفظ/حذف بعد ضغطة)، لا الكتابات الخلفية كتعليم الإشعار مقروءًا.
// =====================================================================

const listeners = new Set();
let toasts = [];
let active = { writes: 0, reads: 0, loaders: 0 };
let seq = 0;

const emit = () => listeners.forEach((fn) => fn());

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const getToasts = () => toasts;
export const getActivity = () => active;

/**
 * يعرض رسالة للمستخدم.
 * notify({ ok: true, text }) أو notify("نص", "error")
 */
export function notify(input, type) {
  let text, kind;
  if (input && typeof input === "object") {
    text = input.text ?? input.message ?? "";
    kind = input.type ?? (input.ok === false ? "error" : "success");
  } else {
    text = String(input ?? "");
    kind = type ?? "success";
  }
  text = String(text).trim();
  if (!text) return;
  // لا تكرار للرسالة نفسها في اللحظة نفسها (نقرتان سريعتان، أو StrictMode)
  const now = Date.now();
  if (toasts.some((t) => t.text === text && t.kind === kind && now - t.at < 1200)) return;
  const id = ++seq;
  toasts = [...toasts.slice(-3), { id, text, kind, at: now }];
  emit();
  return id;
}

export function dismiss(id) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

// ---------------------------------------------------------------------
//  نشاط الشبكة
// ---------------------------------------------------------------------

// «تنفيذ»: كتابة في الجداول، أو دالة في الخادم، أو رفع ملف.
// ما عداها قراءة — ومنها روابط الملفات المؤقتة وتجديد الجلسة.
function kindOf(input, init) {
  const url = typeof input === "string" ? input : input?.url ?? "";
  const method = String(init?.method ?? input?.method ?? "GET").toUpperCase();
  if (/\/auth\/v1\//.test(url) || /\/realtime\//.test(url)) return null;
  if (method === "GET" || method === "HEAD") return "reads";
  if (/\/storage\/v1\/object\/sign\//.test(url)) return "reads";
  if (/\/rest\/v1\/|\/storage\/v1\/object\//.test(url)) return "writes";
  return "reads";
}

// الكتابة «تنفيذ» فقط إن بدأت بعد ضغطة أو مفتاح بقليل، أو تلت كتابة تنفيذية
// أخرى (كالتحويل دفعة واحدة طالبًا بعد طالب). ما عداها خلفي لا يحجب الصفحة.
let interactUntil = 0;
if (typeof window !== "undefined") {
  const mark = () => { interactUntil = Math.max(interactUntil, Date.now() + 2000); };
  window.addEventListener("pointerdown", mark, true);
  window.addEventListener("keydown", mark, true);
}

// حفظ متتابع هادئ (كرصد الدرجات خانةً خانة): لا يحجب الصفحة ولا يقطع الكتابة
let quiet = 0;
export async function quietly(fn) {
  quiet++;
  try { return await fn(); } finally { quiet--; }
}

// سجل أزمنة طلبات Supabase الفعلية (آخر ٦٠ طلبًا، في الذاكرة فقط) — تعرضه
// صفحة «مؤشرات الموقع» لمعرفة هل البطء من قاعدة البيانات أم من الشبكة
const LATENCY_MAX = 60;
const latency = [];
export const getLatencySamples = () => latency.slice();

function recordLatency(input, init, ms, status) {
  const url = typeof input === "string" ? input : input?.url ?? "";
  const m = url.match(/\/(rest|auth|storage|functions)\/v1\/([^?]*)/);
  latency.push({
    ms: Math.round(ms),
    at: Date.now(),
    status,
    method: String(init?.method ?? input?.method ?? "GET").toUpperCase(),
    path: m ? `${m[1]}/${m[2].split("/").slice(0, 2).join("/")}` : url.slice(0, 60),
  });
  if (latency.length > LATENCY_MAX) latency.shift();
}

export async function trackedFetch(input, init) {
  let k = kindOf(input, init);
  if (k === "writes" && (quiet > 0 || Date.now() > interactUntil)) k = "reads";
  if (k) { active = { ...active, [k]: active[k] + 1 }; emit(); }
  const t0 = performance.now();
  let status = 0;
  try {
    const res = await fetch(input, init);
    status = res.status;
    return res;
  } finally {
    recordLatency(input, init, performance.now() - t0, status);
    if (k === "writes") interactUntil = Math.max(interactUntil, Date.now() + 1500);
    if (k) { active = { ...active, [k]: Math.max(0, active[k] - 1) }; emit(); }
  }
}

// أجزاء الصفحة التي تُحمَّل الآن — ما دام أحدها قائمًا تُحجب الصفحة
export function loaderMounted() {
  active = { ...active, loaders: active.loaders + 1 }; emit();
  return () => { active = { ...active, loaders: Math.max(0, active.loaders - 1) }; emit(); };
}
