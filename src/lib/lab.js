// src/lib/lab.js
// أدوات مشتركة لصفحات معمل الحاسب الآلي (الحجز والأجهزة)

// أدوار الإدارة التي تدير المعمل (تطابق lab_is_manager في قاعدة البيانات)
export const LAB_MANAGER_ROLES = ["computer_lab", "principal", "tech_support"];

// المعمل المفعّل حاليًا — المعمل الثاني يُفعَّل لاحقًا من جدول labs
export const DEFAULT_LAB = 1;

export const DEVICE_STATUS = {
  ok:          { label: "يعمل",        dot: "bg-present",  chip: "bg-present/10 text-present" },
  broken:      { label: "معطّل",       dot: "bg-absent",   chip: "bg-danger-light text-absent" },
  maintenance: { label: "في الصيانة",  dot: "bg-late",     chip: "bg-warning-light text-late" },
};

// حقول المواصفات بالترتيب الذي تُعرض به
export const SPEC_FIELDS = [
  { key: "cpu",       label: "المعالج",           ph: "Intel Core i5-10400" },
  { key: "ram",       label: "الذاكرة",           ph: "8 GB" },
  { key: "storage",   label: "التخزين",           ph: "SSD 256 GB" },
  { key: "os",        label: "نظام التشغيل",      ph: "Windows 10" },
  { key: "software",  label: "البرامج المثبّتة",  ph: "Office، Scratch، Python…" },
  { key: "serial_no", label: "الرقم التسلسلي / رقم العهدة", ph: "" },
];

/* ---------------- التواريخ (بالتوقيت المحلي، بصيغة YYYY-MM-DD) ---------------- */

const pad = (n) => String(n).padStart(2, "0");
export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (iso) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoOf(d); };

/** أحد الأسبوع الدراسي لتاريخ معيّن — الجمعة والسبت يتبعان الأسبوع القادم */
export function weekStart(iso) {
  const js = parseISO(iso).getDay(); // الأحد = 0
  return js >= 5 ? addDays(iso, 7 - js) : addDays(iso, -js);
}

/** تاريخ قصير للعرض: 18/10 */
export const shortDate = (iso) => `${+iso.slice(8, 10)}/${+iso.slice(5, 7)}`;

/** اسم الفصل كما يظهر في البوابة */
export const classText = (r) => (r?.class_no ? `فصل ${r.class_no}` : "");

/**
 * موضع الجهاز في رسم المعمل على شكل U (شبكة باتجاه RTL، السبورة في الأعلى).
 * الترقيم يبدأ من يمين المعلم الواقف عند السبورة مواجهًا الطلاب، وهو يسار
 * الرسم: الضلع الأيسر من الأعلى إلى الأسفل، ثم القاعدة من اليسار إلى اليمين،
 * ثم الضلع الأيمن من الأسفل إلى الأعلى. للمعمل بـ 24 جهازًا: 8 + 8 + 8.
 * يعيد { col, row } بترقيم CSS grid، ومعه أبعاد الشبكة كلها.
 */
export function uLayout(total) {
  const arm = Math.ceil(total / 3);
  const base = Math.max(total - 2 * arm, 0);
  const cols = base + 2, rows = arm + 1;
  const pos = (seat) => {
    if (seat <= arm) return { col: cols, row: seat };
    if (seat <= arm + base) return { col: cols - (seat - arm), row: rows };
    return { col: 1, row: rows - (seat - arm - base) };
  };
  return { cols, rows, pos };
}
