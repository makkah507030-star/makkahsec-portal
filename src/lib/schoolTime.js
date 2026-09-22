/** الأحد = 1 … الخميس = 5 (ترقيم النظام) */
export const DAY_NAMES = {
  1: "الأحد", 2: "الاثنين", 3: "الثلاثاء", 4: "الأربعاء", 5: "الخميس",
};

/** عدد الحصص في كل يوم */
export const PERIODS_PER_DAY = { 1: 7, 2: 7, 3: 6, 4: 6, 5: 6 };

export const GRADE_NAMES = {
  1: "الأول الثانوي", 2: "الثاني الثانوي", 3: "الثالث الثانوي",
};

/** تاريخ اليوم بصيغة YYYY-MM-DD بالتوقيت المحلي */
export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** إجازات رسمية تُدار من صفحة «التقويم والإجازات» وتُحمّل من قاعدة البيانات
 *  مرة واحدة عند إقلاع البوابة. أي يوم يقع داخل مدى إجازة مفعّلة يُعامَل
 *  كيوم عطلة كامل في كل الشاشات (تختفي الجداول والتحضير وإحصائيات اليوم).
 *  تبقى فارغة حتى يُستدعى setHolidayRanges بعد التحميل. */
let HOLIDAY_RANGES = [];

/** يُستدعى مرة عند إقلاع البوابة بعد جلب الإجازات المفعّلة.
 *  rows: [{ name, start, end }] بتواريخ ميلادية YYYY-MM-DD. */
export function setHolidayRanges(rows) {
  HOLIDAY_RANGES = Array.isArray(rows) ? rows : [];
}

/** كائن الإجازة الرسمية لليوم { name } إن وقع اليوم داخل مداها، وإلا null */
export function holidayToday() {
  const t = todayISO();
  const h = HOLIDAY_RANGES.find(
    (r) => r.start && t >= r.start && t <= (r.end || r.start),
  );
  return h ? { name: h.name } : null;
}

/** يوم اليوم بترقيم النظام، و0 يعني يوم عطلة (نهاية أسبوع أو إجازة رسمية) */
export function todayDow() {
  if (holidayToday()) return 0;        // إجازة رسمية → يوم عطلة كامل
  const js = new Date().getDay();      // الأحد = 0
  const d = js + 1;
  return d >= 1 && d <= 5 ? d : 0;
}

export function todayLabel() {
  const h = holidayToday();
  if (h) return h.name;                 // اسم الإجازة الرسمية
  const d = todayDow();
  return d ? DAY_NAMES[d] : "عطلة نهاية الأسبوع";
}

export const STATUS = {
  present: { label: "حاضر",   tone: "present" },
  absent:  { label: "غائب",   tone: "absent"  },
  late:    { label: "متأخر",  tone: "late"    },
  excused: { label: "مستأذن", tone: "excused" },
};
