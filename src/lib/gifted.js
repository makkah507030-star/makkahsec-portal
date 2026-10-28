// src/lib/gifted.js
/* =====================================================================
   برنامج الموهوبين — البرنامج الوطني للكشف عن الموهوبين (مقياس موهبة للقدرات العقلية
   المتعددة) بنسخته السابعة عشرة (supabase/gifted_1.sql). طلاب الأول الثانوي في المستوى
   الثالث، ويُدخل المستوى مرة واحدة. المواعيد من دليل التسجيل في موقع موهبة.
   ===================================================================== */

export const MAWHIBA = {
  edition: "السابعة عشرة",
  grade: 1,                                   // الأول الثانوي
  regFrom: "2026-10-01", regTo: "2026-12-28",  // التسجيل
  testFrom: "2026-11-30", testTo: "2026-12-30", // تطبيق المقياس في مراكز قياس
  fee: 200,                                   // ريال، ومجاني للترشيح المدعوم
  url: "https://www.mawhiba.sa/discover-mawhiba/programs/national-program-for-gifted-identification/national-program-for-gifted-identification/",
};

// مراحل الطالب بالترتيب، ولكل مرحلة لونها
export const STATUS = {
  none:       { t: "لم يسجّل",       c: "bg-canvas text-muted",          bar: "#C9D3CD" },
  registered: { t: "سجّل",           c: "bg-excused/10 text-excused",    bar: "#3A72B5" },
  confirmed:  { t: "أكّد الحضور",     c: "bg-late/10 text-late",          bar: "#B8912F" },
  tested:     { t: "اختُبر",          c: "bg-mint-tint text-mint-deep",   bar: "#3E8A62" },
  gifted:     { t: "موهوب",          c: "bg-present/15 text-present",    bar: "#1F8A5B" },
  not_gifted: { t: "لم يُكتشف",       c: "bg-canvas text-faint",          bar: "#8A9A91" },
  prior:      { t: "اختُبر سابقًا",    c: "bg-canvas text-faint",          bar: "#AEB8B2" },
};
export const FLOW = ["none", "registered", "confirmed", "tested", "gifted", "not_gifted", "prior"];
export const PAY = { paid: "دفع الرسوم", supported: "ترشيح مدعوم" };

/** هل بلغ الطالب المرحلة (للنسب): المسجّل يشمل من أكّد ومن اختُبر ومن ظهرت نتيجته */
const RANK = { none: 0, registered: 1, confirmed: 2, tested: 3, gifted: 4, not_gifted: 4 };
export const reached = (status, step) => status !== "prior" && (RANK[status] ?? 0) >= RANK[step];

const greg = (iso) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { weekday: "long", day: "numeric", month: "long" })
  .format(new Date(`${iso}T12:00:00`)).replace("،", "");
/** مدى تاريخين مختصر: 1 أكتوبر – 28 ديسمبر 2026 */
export const span = (a, b) => {
  const f = (iso, y) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", ...(y ? { year: "numeric" } : {}) }).format(new Date(`${iso}T12:00:00`));
  return `${f(a)} – ${f(b, true)}`;
};

/** رسالة الواتساب الجاهزة بحسب مرحلة الطالب، للطالب أو لولي أمره */
export function waText(r, guardian) {
  const who = guardian ? `ولي أمر الطالب ${r.name}` : `الطالب ${r.name}`;
  const head = `${who}، السلام عليكم ورحمة الله.\nبرنامج الموهوبين بمدرسة مكة الثانوية:`;
  const body = {
    none: `نذكّر بالتسجيل في البرنامج الوطني للكشف عن الموهوبين (مقياس موهبة) عبر منصة موهبة قبل ${greg(MAWHIBA.regTo)}، وهي فرصة لاكتشاف القدرات والالتحاق ببرامج موهبة الإثرائية.`,
    registered: "تم التسجيل في مقياس موهبة، ويبقى تأكيد الحضور ودفع الرسوم (أو تأكيد الترشيح المدعوم) من منصة موهبة.",
    confirmed: r.test_date
      ? `موعد مقياس موهبة يوم ${greg(r.test_date)}${r.test_center ? ` في ${r.test_center}` : ""}. نرجو الحضور مبكرًا مع إثبات الهوية، والنوم الكافي قبله. بالتوفيق.`
      : "تم تأكيد الحضور في مقياس موهبة. نرجو متابعة موعد المقياس ومركزه في منصة موهبة وإبلاغنا به.",
    tested: "نشكر المشاركة في مقياس موهبة، وتُعلن النتائج في منصة موهبة. بالتوفيق.",
    gifted: "نبارك اكتشاف الطالب موهوبًا في البرنامج الوطني للكشف عن الموهوبين، ونتطلع لمشاركته في برامج موهبة الإثرائية.",
    not_gifted: "نشكر المشاركة في مقياس موهبة، ونتطلع لمشاركة الطالب في برامج المدرسة الإثرائية.",
  }[r.status];
  return body ? `${head}\n${body}` : "";
}
