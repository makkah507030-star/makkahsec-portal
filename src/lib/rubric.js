// src/lib/rubric.js
/* =====================================================================
   جدول بنود الأداء (حقل من نوع rubric في النماذج) — كما في «الملاحظة الصفية
   وفق بنود الأداء الوظيفي»: لكل عنصر وزن نسبي وأمثلة وشواهد، ويضع الزائر
   علامة التحقق أمام كل شاهد، ويقدّر العنصر من ٥، ويكتب ملاحظته.

   تعريف الحقل (في form_templates.fields):
     { type: "rubric", name, label, note?, evidence_label?,
       items: [{ title, weight, examples: [..], evidence: [..] }] }
   قيمته في المستند: { [فهرس العنصر]: { check: [bool…], score: 1..5, note } }
   ===================================================================== */

export const RATING_LEVELS = [
  { v: 5, label: "ممتاز" },
  { v: 4, label: "جيد جدًا" },
  { v: 3, label: "جيد" },
  { v: 2, label: "مقبول" },
  { v: 1, label: "غير مرضٍ" },
];

export const ratingLabel = (v) => RATING_LEVELS.find((l) => l.v === Number(v))?.label ?? "";

const round1 = (n) => Math.round(n * 10) / 10;

/* درجة العنصر الموزونة: الوزن × التقدير ÷ ٥ */
export const itemPoints = (item, entry) => {
  const s = Number(entry?.score);
  return s >= 1 && s <= 5 ? round1((Number(item.weight) || 0) * s / 5) : null;
};

/* مجموع القسم: النقاط المحققة من الأوزان المقدَّرة، والوزن الكلي للقسم */
export function rubricScore(field, value) {
  const items = field?.items ?? [];
  let points = 0, rated = 0;
  items.forEach((it, i) => {
    const p = itemPoints(it, value?.[i]);
    if (p != null) { points += p; rated++; }
  });
  const max = items.reduce((a, it) => a + (Number(it.weight) || 0), 0);
  return { points: round1(points), max, rated, count: items.length };
}

/* أوصاف مستويات التقدير في النموذج المعتمد — الدليل الإرشادي لإدارة الأداء الوظيفي (النسخة الثانية) */
export const OFFICIAL_LEVELS = [
  { v: 5, label: "مثالي" },
  { v: 4, label: "تخطى التوقعات" },
  { v: 3, label: "وافق التوقعات" },
  { v: 2, label: "بحاجة إلى تطوير" },
  { v: 1, label: "غير مرضٍ" },
];
export const officialLabel = (v) => OFFICIAL_LEVELS.find((l) => l.v === Number(v))?.label ?? "";

/* التقدير الموزون في النموذج المعتمد: تقدير العنصر (1–5) × وزنه النسبي، ومجموعها التقدير العام من 5 */
export const weightedRating = (item, entry) => {
  const s = Number(entry?.score);
  return s >= 1 && s <= 5 ? Math.round(s * (Number(item.weight) || 0)) / 100 : null;
};

/* لون كل درجة (1–5): أحمر، برتقالي، ذهبي، أزرق، أخضر — خلفية فاتحة ونص داكن للطباعة */
const TONES = {
  1: { bg: "#FCE4E1", fg: "#A3352B", bd: "#E9A79F" },
  2: { bg: "#FDEBDD", fg: "#A2541A", bd: "#F0B88C" },
  3: { bg: "#FFF4CC", fg: "#7A5C00", bd: "#E8CF6E" },
  4: { bg: "#E3EFFA", fg: "#24548A", bd: "#9CC3E3" },
  5: { bg: "#DDF3E6", fg: "#1F6B45", bd: "#89D7AD" },
};
export const gradeTone = (g) => TONES[Number(g)] ?? null;

/* التقدير العام من النسبة المئوية */
export function overallLabel(pct) {
  if (pct == null) return "";
  if (pct >= 90) return "ممتاز";
  if (pct >= 80) return "جيد جدًا";
  if (pct >= 70) return "جيد";
  if (pct >= 60) return "مقبول";
  return "غير مرضٍ";
}
