// ترتيب أبجدي عربي للأسماء: «أحمد» و«احمد» و«إبراهيم» تحت الألف معًا.
// ترتيب قاعدة البيانات (order("full_name")) يفصل الهمزات عن الألف، فيُعاد الترتيب هنا.
const collator = new Intl.Collator("ar", { sensitivity: "base", numeric: true });

/** مقارنة نصين أبجديًا */
export const cmpAr = (a, b) => collator.compare(a ?? "", b ?? "");

/** دالة ترتيب بالاسم: byName() لحقل full_name، أو byName((r) => r.students?.full_name) */
export const byName = (get = (r) => r?.full_name) => (a, b) => cmpAr(get(a), get(b));

/** ترتيب حسب الصف ثم الفصل ثم الاسم (أبجدي داخل كل فصل) */
export const byClassName = (get = (r) => r?.full_name) => (a, b) =>
  (a.grade ?? 0) - (b.grade ?? 0) || (a.class_no ?? 0) - (b.class_no ?? 0) || cmpAr(get(a), get(b));
