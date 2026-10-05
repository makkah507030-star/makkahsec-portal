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

/* التقدير العام من النسبة المئوية */
export function overallLabel(pct) {
  if (pct == null) return "";
  if (pct >= 90) return "ممتاز";
  if (pct >= 80) return "جيد جدًا";
  if (pct >= 70) return "جيد";
  if (pct >= 60) return "مقبول";
  return "غير مرضٍ";
}
