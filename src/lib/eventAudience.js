// src/lib/eventAudience.js
/* =====================================================================
   الحدث للمدرسة كلها حسب الفئة (school_events.audience).
   الفئة تُحسب آليًا لا بأسطر في event_participants: أعدادها في audience_counts
   (يحسبها الخادم)، ومن حضر من المعلمين والإدارة بالاسم في audience_attended.
   ملفا SQL: supabase/events_audience_1.sql و events_audience_2.sql.
   ===================================================================== */

export const AUDIENCE = [
  { k: "teachers",  t: "المعلمون" },
  { k: "students",  t: "الطلاب" },
  { k: "guardians", t: "أولياء الأمور" },
  { k: "admin",     t: "الإدارة" },
];
const KEYS = AUDIENCE.map((a) => a.k);

export const audienceOf = (e) => (e?.audience ?? []).filter((k) => KEYS.includes(k));

/* نطاق الطلاب وأولياء الأمور (school_events.audience_scope — events_audience_3.sql):
   {} المدرسة كلها، {grade} صف كامل، {grade, classes:[101, 102]} فصول منه */
export const GRADES = { 1: "الأول الثانوي", 2: "الثاني الثانوي", 3: "الثالث الثانوي" };
export const scopeOf = (e) => {
  const s = e?.audience_scope ?? {};
  return s.grade ? { grade: Number(s.grade), classes: (s.classes ?? []).map(Number) } : {};
};
/** «المدرسة كلها» أو «الصف الأول الثانوي» أو «الفصول 101، 102» */
export const scopeText = (scope) =>
  !scope?.grade ? "المدرسة كلها"
  : scope.classes?.length ? `${scope.classes.length > 1 ? "الفصول" : "الفصل"} ${scope.classes.join("، ")}`
  : `الصف ${GRADES[scope.grade]}`;
const massKinds = (e) => audienceOf(e).filter((k) => k === "students" || k === "guardians");

export const audienceLabel = (e) => {
  const t = audienceOf(e).map((k) => AUDIENCE.find((a) => a.k === k).t).join("، ");
  return massKinds(e).length && scopeOf(e).grade ? `${t} (${scopeText(scopeOf(e))})` : t;
};
/** «للمدرسة كلها» أو «للصف الأول الثانوي» أو «لفصول 101، 102» */
export function scopePlace(sc) {
  if (!sc?.grade) return "للمدرسة كلها";
  if (!sc.classes?.length) return `للصف ${GRADES[sc.grade]}`;
  return `${sc.classes.length > 1 ? "لفصول" : "للفصل"} ${sc.classes.join("، ")}`;
}
export const audiencePlace = (e) => scopePlace(massKinds(e).length ? scopeOf(e) : {});

/** الفئات التي يُسجَّل حضورها بالاسم وتصدر لها الشهادات: المعلمون والإدارة */
export const staffKinds = (e) => audienceOf(e).filter((k) => k === "teachers" || k === "admin");

/** حدث الطلاب أو أولياء الأمور للمدرسة كلها لا يحتاج موافقة ولا استئذانًا،
    وكذلك حدث المعلمين والإدارة إن لم يُسمَّ فيه طلاب */
export function skipsConsent(e, parts) {
  const a = audienceOf(e);
  return a.includes("students") || a.includes("guardians") || (a.length > 0 && !(parts ?? []).length);
}

/** شهادات الحدث المطبوعة خارج event_participants: المعلمون والإدارة والضيوف.
    تاريخ الطباعة الأولى cert_at مع كل اسم في audience_attended و guests */
export const listCerts = (e) =>
  [...(e?.audience_attended ?? []), ...(Array.isArray(e?.guests) ? e.guests : [])].filter((x) => x?.cert_at).length;

/** المستفيدون من الحدث. c: عدّ الطلاب المسمَّين {total, attended}.
    الطلاب: كلهم إن كان الحدث لهم (والمسمَّون منهم ضمنهم)، وإلا المسمَّون.
    أولياء الأمور: كلهم إن كانوا من فئته. المعلمون والإدارة: المستهدفون كلهم، والحاضر من سُجّل بالاسم.
    مطابق لدالة ev_reach في الخادم. */
export function eventReach(e, c = {}) {
  const a = audienceOf(e);
  const n = e?.audience_counts ?? {};
  const allStudents = a.includes("students");
  const students = allStudents ? n.students ?? 0 : c.total ?? 0;
  const studentsIn = allStudents ? n.students ?? 0 : c.attended ?? 0;
  const guardians = a.includes("guardians") ? n.guardians ?? 0 : 0;
  const staff = staffKinds(e).length ? n.staff ?? 0 : 0;
  const staffIn = (e?.audience_attended ?? []).length;
  return {
    nominated: students + guardians + staff,
    attended: studentsIn + guardians + staffIn,
    students: studentsIn, guardians, staff: staffIn,
  };
}
