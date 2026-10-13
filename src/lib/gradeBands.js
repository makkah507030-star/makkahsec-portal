/**
 * تقدير المعدل حسب النظام المعتمد وزاريًا (شرائح كل 10 درجات):
 * ممتاز 90+  ·  جيد جدًا 80-89.99  ·  جيد 70-79.99
 * مقبول 60-69.99  ·  ضعيف 50-59.99  ·  راسب أقل من 50
 *
 * "راسب" تُستخدم فقط في تقرير الاختبارات النهائية (report_type === "final")؛
 * في تقارير الفترات (period1 / period2) يُكتفى بتصنيف "ضعيف" لأي معدل دون 60،
 * لأن الرسوب حالة نهاية عام ولا معنى لها في منتصف الفصل.
 */
const BANDS = [
  { min: 90, label: "ممتاز", bg: "#EDFAF2", text: "#3E6350", solid: "#4E7D66" },
  { min: 80, label: "جيد جدًا", bg: "#E9F1FB", text: "#2C5079", solid: "#3F6B99" },
  { min: 70, label: "جيد", bg: "#EAF4FE", text: "#2A6BA8", solid: "#3E8FD1" },
  { min: 60, label: "مقبول", bg: "#FBF3DE", text: "#7A5F16", solid: "#9A7B22" },
  { min: 50, label: "ضعيف", bg: "#FCEADD", text: "#8A4B14", solid: "#B4661E" },
  { min: -Infinity, label: "راسب", bg: "#FBEBEB", text: "#7A2B2B", solid: "#A23B3B" },
];

/** يعيد وصف الشريحة (label + ألوان) لمعدل مُعطى، مع مراعاة نوع التقرير */
export function gradeBand(average, reportType) {
  if (average == null || Number.isNaN(Number(average))) return null;
  const avg = Number(average);
  let band = BANDS.find((b) => avg >= b.min) ?? BANDS[BANDS.length - 1];

  // لا نعرض "راسب" إلا في تقرير الاختبارات النهائية
  if (band.label === "راسب" && reportType !== "final") {
    band = BANDS.find((b) => b.label === "ضعيف");
  }
  return band;
}

export const REPORT_TYPE_LABEL = {
  period1: "الفترة الأولى",
  period2: "الفترة الثانية",
  final: "الاختبارات النهائية",
};

/**
 * لون مستوى مكتوب نصًّا في النماذج (ممتاز، جيد جدًا، جيد، مقبول، ضعيف):
 * يعيد { label, bg, text, solid } أو null إن لم يكن النص مستوى.
 * ألوان أقوى من شرائح المعدل ليتميّز كل مستوى في الاستمارة المطبوعة.
 */
const LEVELS = {
  "ممتاز":   { label: "ممتاز",   bg: "#D4F0DF", text: "#1F5A3A", solid: "#2E7D52" },
  "جيد جدا": { label: "جيد جدًا", bg: "#DCE8F8", text: "#23466F", solid: "#3F6B99" },
  "جيد":     { label: "جيد",     bg: "#DDF1F3", text: "#1C5F68", solid: "#2C8792" },
  "مقبول":   { label: "مقبول",   bg: "#FBEFCF", text: "#7A5A0A", solid: "#B08A1E" },
  "ضعيف":    { label: "ضعيف",    bg: "#F9D9D9", text: "#8E2424", solid: "#B23A3A" },
};
LEVELS["راسب"] = LEVELS["ضعيف"];
// صيغ المؤنث: «ممتازة»، «جيدة جدا»…
[["ممتازة", "ممتاز"], ["جيدة جدا", "جيد جدا"], ["جيدة", "جيد"], ["مقبولة", "مقبول"], ["ضعيفة", "ضعيف"]]
  .forEach(([f, m]) => { LEVELS[f] = LEVELS[m]; });

export function levelBand(value) {
  const s = String(value ?? "").replace(/[\u064B-\u0652]/g, "").replace(/\s+/g, " ").trim();
  return LEVELS[s] ?? null;
}
