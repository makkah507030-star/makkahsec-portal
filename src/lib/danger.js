// src/lib/danger.js
// تأكيد الإجراءات الحساسة — بديل window.confirm يُعرض في نافذة واحدة (DangerHost).
//   if (!(await confirmDanger({ title, impact, level: "high" }))) return;
//
// level "high": إجراء على المدرسة كلها لا يُتراجع عنه بالكامل، فيلزم كتابة كلمة التأكيد «مكة».
// level "medium": يؤثر على الجميع ويمكن التراجع عنه، فيكفي زر التأكيد بعد قراءة الأثر.
// كل تأكيد يُسجَّل في سجل العمليات (supabase/audit_log.sql) باسم الحساب الذي نفّذه.

import { supabase } from "./supabase";
import { quietly } from "./notice";

export const CONFIRM_WORD = "مكة";

// «مكه» بالهاء مقبولة أيضًا، فكثيرون يكتبونها هكذا على لوحة الجوال
export const isConfirmWord = (v) => String(v ?? "").trim().replace(/ه$/, "ة") === CONFIRM_WORD;

const listeners = new Set();
let current = null;

const emit = () => listeners.forEach((fn) => fn());

export function subscribeDanger(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const getDanger = () => current;

/** يعرض نافذة التأكيد ويعيد true عند التأكيد، وfalse عند الإلغاء. */
export function confirmDanger({ title, impact = [], level = "medium", confirmLabel = "متابعة" }) {
  // طلب جديد قبل إغلاق السابق يلغي السابق
  current?.resolve(false);
  return new Promise((resolve) => {
    current = {
      title, level, confirmLabel,
      impact: (Array.isArray(impact) ? impact : [impact]).filter(Boolean),
      resolve: (v) => {
        current = null; emit();
        if (v) logOperation({ title, impact, level });
        resolve(v);
      },
    };
    emit();
  });
}

// لا يعطّل الإجراء لو فشل التسجيل (الجدول غير منشأ بعد مثلًا)
// وبهدوء: لا يُظهر «جاري التنفيذ» خاصًا به فوق الإجراء نفسه
function logOperation({ title, impact, level }) {
  quietly(() => supabase.from("audit_log").insert({
    action: String(title ?? ""),
    details: (Array.isArray(impact) ? impact : [impact]).filter(Boolean).map(String),
    level,
    path: typeof window !== "undefined" ? window.location.pathname : null,
  })).then(() => {}, () => {});
}
