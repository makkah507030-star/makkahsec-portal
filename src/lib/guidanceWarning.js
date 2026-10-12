// src/lib/guidanceWarning.js
import { WARNING_STAGES } from "./officialAttendance";

/* =====================================================================
   تسميات الحالات وحدود الإنذار المبكر في التوجيه الطلابي — مشتركة بين تبويب «الإنذار المبكر»
   (pages/Guidance.jsx) ولقطته في التقرير الشهري (pages/guidance/).
   ===================================================================== */

// مصدر الحالة ونوع الجلسة ونتيجة الإغلاق
export const SOURCE = { warning: "الإنذار المبكر", referral: "إحالة", guardian: "طلب ولي الأمر", student: "طلب الطالب", teacher: "ملاحظة معلم", other: "أخرى" };
export const KIND = { individual: "فردية", group: "جماعية", guardian: "مع ولي الأمر", teacher: "مع المعلم" };
export const OUTCOME = { improved: "تحسّنت الحالة", referred: "أُحيلت لجهة مختصة", continuing: "مستمرة تُتابع لاحقًا" };

export const WATCH_AT = 5;          // متابعة الغياب كما في «الإنذارات والمحاضر»
export const LATE_AT = 3;           // التأخر الصباحي: الموقف الثالث
export const LOW_SUBJECTS_AT = 2;   // مادتان فأكثر دون 60٪

export const absStage = (d) => [...WARNING_STAGES].reverse().find((s) => d >= s.days)?.label ?? (d >= WATCH_AT ? "متابعة" : null);

// أسباب ظهور الطالب في الإنذار المبكر
export function reasonsOf(r) {
  const out = [];
  const st = absStage(r.absent_days);
  if (st) out.push({ k: "absence", t: `غياب ${r.absent_days} أيام · ${st}`, c: "bg-absent/10 text-absent" });
  if (r.late_days >= LATE_AT) out.push({ k: "late", t: `تأخر صباحي ${r.late_days} مرات`, c: "bg-late/10 text-late" });
  if (r.low_subjects.length >= LOW_SUBJECTS_AT)
    out.push({ k: "study", t: `تعثر دراسي: ${r.low_subjects.join("، ")}`, c: "bg-excused/10 text-excused" });
  if (r.referrals > 0)
    out.push({ k: "behavior", t: `إحالات ${r.referrals}${r.max_degree ? ` · الدرجة ${r.max_degree}` : ""}`, c: "bg-warning-light text-warning" });
  return out;
}
