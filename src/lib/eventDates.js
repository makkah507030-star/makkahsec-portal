// src/lib/eventDates.js
// تاريخ الحدث: يوم واحد (event_date)، أو فترة ممتدة حتى end_date (supabase/events_range.sql).

/** هل الحدث ممتد لأكثر من يوم؟ */
export const isRange = (e) => !!e?.end_date && e.end_date !== e.event_date;

/** آخر يوم في الحدث (يوم البدء للحدث اليومي) */
export const lastDay = (e) => (isRange(e) ? e.end_date : e?.event_date);

/** نص التاريخ بدالة التنسيق المعطاة: «28/09/2026» أو «من 01/10/2026 إلى 30/12/2026» */
export function eventDateRange(e, fmt) {
  if (!e?.event_date) return "";
  return isRange(e) ? `من ${fmt(e.event_date)} إلى ${fmt(e.end_date)}` : fmt(e.event_date);
}

/** حقل end_date للحفظ: فارغ أو مساوٍ للبدء = يوم واحد. يُرسل فقط إن استُخدم (قبل تشغيل الملف لا يُرسل) */
export function endDatePatch(f, was = null) {
  const end = f.end_date && f.end_date > f.event_date ? f.end_date : null;
  return end || was?.end_date ? { end_date: end } : {};
}
