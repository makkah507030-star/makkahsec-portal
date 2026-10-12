// src/lib/idle.js
// الخروج التلقائي عند عدم النشاط (components/IdleLogout.jsx):
// آخر نشاط محفوظ في المتصفح مشتركًا بين التبويبات، فالعمل في تبويب يمدد الجلسة في غيره.

// مدة الخمول المسموح بها بحسب الحساب (بالدقائق) — للإدارة فقط؛
// المعلم والطالب وولي الأمر لا يخرجون تلقائيًا
export const IDLE_MINUTES = { admin: 20 };
export const WARN_SECONDS = 60;          // التنبيه قبل الخروج

const KEY = "mk_last_active";
const OUT = "mk_idle_out";

/** آخر نشاط لهذا الحساب، أو null إن لم يُسجَّل له نشاط بعد */
export function lastActive(uid) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v?.uid === uid ? Number(v.at) || null : null;
  } catch { return null; }
}

export function touchActive(uid, at = Date.now()) {
  try { localStorage.setItem(KEY, JSON.stringify({ uid, at })); } catch { /* تجاهل */ }
}

/** عند الدخول: يبدأ العدّ من الآن، فلا يُحتسب خمول جلسة سابقة */
export function startActive() {
  try { localStorage.removeItem(KEY); } catch { /* تجاهل */ }
}

// علامة تعرض بها صفحة الدخول «سُجّل خروجك لعدم النشاط» مرة واحدة
export function markIdleOut() { try { localStorage.setItem(OUT, "1"); } catch { /* تجاهل */ } }
export function wasIdleOut() { try { return localStorage.getItem(OUT) === "1"; } catch { return false; } }
export function clearIdleOut() { try { localStorage.removeItem(OUT); } catch { /* تجاهل */ } }
