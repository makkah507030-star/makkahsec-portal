// الفئات المستهدفة للأدلة — مصدر موحّد للواجهة والإدارة
export const AUDIENCES = [
  { key: "general",  label: "عام",              desc: "يخصّ الجميع" },
  { key: "admin",    label: "الإدارة المدرسية", desc: "منسوبو الإدارة" },
  { key: "teacher",  label: "المعلمون",         desc: "الكادر التعليمي" },
  { key: "student",  label: "الطلاب",           desc: "طلاب المدرسة" },
  { key: "guardian", label: "أولياء الأمور",    desc: "أولياء أمور الطلاب" },
];

export const audienceLabel = (k) =>
  AUDIENCES.find((a) => a.key === k)?.label ?? k;

// 1.4 MB
export function fmtSize(bytes) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} م.ب`;
  return `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;
}
