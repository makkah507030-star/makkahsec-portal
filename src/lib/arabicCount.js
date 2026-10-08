/**
 * عدّ المعدود بالصيغة الصحيحة نحويًا:
 *   1 → «معلم واحد»، 2 → «معلمان»، 3–10 → «3 معلمين»، 11 فأكثر → «11 معلمًا».
 * الأرقام لاتينية كبقية البوابة. للمثنى حالة الرفع افتراضيًا،
 * وتُمرَّر { acc: true } لحالة النصب/الجر («لـ معلمين»).
 */
const NOUNS = {
  teacher: { one: "معلم واحد", two: ["معلمان", "معلمين"], few: "معلمين", many: "معلمًا" },
  student: { one: "طالب واحد", two: ["طالبان", "طالبين"], few: "طلاب", many: "طالبًا" },
  period: { one: "حصة واحدة", two: ["حصتان", "حصتين"], few: "حصص", many: "حصة" },
  day: { one: "يوم واحد", two: ["يومان", "يومين"], few: "أيام", many: "يومًا" },
};

export function countAr(n, noun, { acc = false } = {}) {
  const f = NOUNS[noun];
  const v = Number(n) || 0;
  if (v === 1) return f.one;
  if (v === 2) return f.two[acc ? 1 : 0];
  if (v >= 3 && v <= 10) return `${v} ${f.few}`;
  return `${v} ${f.many}`;
}
