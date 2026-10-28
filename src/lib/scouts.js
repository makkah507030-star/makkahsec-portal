// src/lib/scouts.js
/* =====================================================================
   الفريق الكشفي — الهيكل والتحضير والتقييم (supabase/scouts_5..7.sql):
   المناصب، وحالات التحضير، ومعايير التقييم الأسبوعي، وحساب النسب.
   ===================================================================== */

// المناصب في الفريق: العريف الأول ونائبه على الفريق كله، والعريف ونائبه على طليعته
export const POSTS = {
  chief:         { t: "العريف الأول",       short: "عريف أول" },
  chief_deputy:  { t: "نائب العريف الأول",   short: "نائب العريف الأول" },
  patrol_leader: { t: "عريف الطليعة",       short: "عريف" },
  patrol_deputy: { t: "نائب العريف",        short: "نائب عريف" },
  member:        { t: "عضو",               short: "عضو" },
};

// ترتيب المناصب في الهيكل: العريف الأول، ثم نائبه تحته، ثم عرفاء الطلائع ونوابهم
export const POST_ORDER = ["chief", "chief_deputy", "patrol_leader", "patrol_deputy", "member"];
const postRank = (m) => POST_ORDER.indexOf(m.post);
/** ترتيب الأعضاء بالهيكل: قيادة الفريق، ثم كل طليعة بترتيبها (عريفها ثم نائبه ثم أعضاؤها) */
export const byHierarchy = (patrols) => {
  const at = (m) => (m.post === "chief" || m.post === "chief_deputy" ? -1 : Math.max(0, patrols.findIndex((p) => p.id === m.patrol_id)));
  return (a, b) => at(a) - at(b) || postRank(a) - postRank(b);
};

export const ATT_KIND = { lineup: "الاصطفاف الصباحي", recess: "الفسحة" };
export const ATT_STATUS = {
  present: { t: "حاضر",  c: "bg-present text-white",  soft: "bg-present/10 text-present" },
  late:    { t: "متأخر", c: "bg-late text-white",     soft: "bg-late/10 text-late" },
  excused: { t: "مستأذن", c: "bg-excused text-white", soft: "bg-excused/10 text-excused" },
  absent:  { t: "غائب",  c: "bg-absent text-white",   soft: "bg-absent/10 text-absent" },
};

// معايير التقييم الأسبوعي للطليعة وللعضو، لكل معيار 10 درجات
export const CRITERIA = [
  { k: "discipline", t: "الانضباط" },
  { k: "tasks", t: "إنجاز المهام" },
  { k: "appearance", t: "المظهر والنظافة" },
  { k: "cooperation", t: "التعاون" },
];
export const CRITERIA_MAX = CRITERIA.length * 10;
export const evalTotal = (scores) => CRITERIA.reduce((a, c) => a + (Number(scores?.[c.k]) || 0), 0);
export const evalRated = (scores) => CRITERIA.some((c) => scores?.[c.k] != null && scores[c.k] !== "");

/** أحد الأسبوع (بداية الأسبوع الدراسي) لتاريخ بصيغة YYYY-MM-DD */
export function weekStart(iso) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}
export const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/** نسبة الحضور: الحاضر والمتأخر من المسجَّل، والمستأذن لا يُحتسب */
export function attendPct(marks) {
  const counted = marks.filter((m) => m.status !== "excused");
  if (!counted.length) return null;
  return Math.round((100 * counted.filter((m) => m.status !== "absent").length) / counted.length);
}

/** لون الطليعة الافتراضي بالترتيب */
export const PATROL_COLORS = ["#3E8A62", "#3A72B5", "#B8912F", "#B4506A", "#6B5BB5", "#2F8F8A"];
