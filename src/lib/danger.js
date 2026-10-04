// src/lib/danger.js
// تأكيد الإجراءات الحساسة — بديل window.confirm يُعرض في نافذة واحدة (DangerHost).
//   if (!(await confirmDanger({ title, impact, level: "high" }))) return;
//
// level "high": إجراء على المدرسة كلها لا يُتراجع عنه بالكامل، فيلزم كتابة كلمة التأكيد.
// level "medium": يؤثر على الجميع ويمكن التراجع عنه، فيكفي زر التأكيد بعد قراءة الأثر.

export const CONFIRM_WORD = "تأكيد";

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
      resolve: (v) => { current = null; emit(); resolve(v); },
    };
    emit();
  });
}
