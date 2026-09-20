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
