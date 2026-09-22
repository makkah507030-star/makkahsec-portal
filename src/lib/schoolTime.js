/** الأحد = 1 … الخميس = 5 (ترقيم النظام) */
export const DAY_NAMES = {
  1: "الأحد", 2: "الاثنين", 3: "الثلاثاء", 4: "الأربعاء", 5: "الخميس",
};

/** عدد الحصص في كل يوم */
export const PERIODS_PER_DAY = { 1: 7, 2: 7, 3: 6, 4: 6, 5: 6 };

export const GRADE_NAMES = {
  1: "الأول الثانوي", 2: "الثاني الثانوي", 3: "الثالث الثانوي",
};

/** إجازات رسمية بتواريخ محددة (خارج نهاية الأسبوع). تُعامَل كيوم عطلة كامل:
 *  تختفي جداول اليوم والتحضير وإحصائيات اليوم في كل الشاشات تلقائيًا،
 *  ويظهر اسم الإجازة بدل «عطلة نهاية الأسبوع».
 *  المفتاح تاريخ ميلادي YYYY-MM-DD (بالتوقيت المحلي)، والقيمة اسم الإجازة. */
export const HOLIDAYS = {
  "2026-09-23": "إجازة اليوم الوطني",   // الأربعاء ١٢/٤/١٤٤٨هـ
  "2026-09-24": "إجازة اليوم الوطني",   // الخميس ١٣/٤/١٤٤٨هـ
};

/** تاريخ اليوم بصيغة YYYY-MM-DD بالتوقيت المحلي */
export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** اسم الإجازة الرسمية لليوم إن وُجد، وإلا null */
export function holidayToday() {
  return HOLIDAYS[todayISO()] ?? null;
}

/** يوم اليوم بترقيم النظام، و0 يعني يوم عطلة (نهاية أسبوع أو إجازة رسمية) */
export function todayDow() {
  if (HOLIDAYS[todayISO()]) return 0;  // إجازة رسمية → يوم عطلة كامل
  const js = new Date().getDay();      // الأحد = 0
  const d = js + 1;
  return d >= 1 && d <= 5 ? d : 0;
}

export function todayLabel() {
  const h = HOLIDAYS[todayISO()];
  if (h) return h;                      // اسم الإجازة الرسمية
  const d = todayDow();
  return d ? DAY_NAMES[d] : "عطلة نهاية الأسبوع";
}

export const STATUS = {
  present: { label: "حاضر",   tone: "present" },
  absent:  { label: "غائب",   tone: "absent"  },
  late:    { label: "متأخر",  tone: "late"    },
  excused: { label: "مستأذن", tone: "excused" },
};
