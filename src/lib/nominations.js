// src/lib/nominations.js
/* =====================================================================
   الترشيحات — إعلانات التقديم للطلاب وطلباتهم (supabase/nominations_1..4.sql).
   التسميات والحالات والإشعارات المشتركة بين صفحة الإدارة وصفحة الطالب وولي الأمر.
   ===================================================================== */
import { notifyUsers } from "./referrals.js";
import { todayISO } from "./schoolTime.js";

// مراحل الطلب كما تظهر للإدارة، و«قيد الدراسة» كما تظهر للطالب قبل إعلان النتائج
export const STAGE = {
  applied:     { t: "مقدَّم",          c: "bg-canvas text-muted" },
  shortlisted: { t: "مرشح للمقابلة",   c: "bg-excused/10 text-excused" },
  review:      { t: "قيد الدراسة",     c: "bg-late/10 text-late" },
  accepted:    { t: "مقبول",           c: "bg-present/10 text-present" },
  reserve:     { t: "احتياط",          c: "bg-late/10 text-late" },
  rejected:    { t: "غير مقبول",       c: "bg-absent/10 text-absent" },
  withdrawn:   { t: "منسحب",           c: "bg-canvas text-faint" },
};

// الشروط التلقائية ونصوصها
export const RULES = {
  min_attend: { t: "نسبة الحضور لا تقل عن", unit: "%", fail: "attend", val: (e) => e?.attend },
  max_degree: { t: "لا مخالفة سلوكية أعلى من الدرجة", unit: "", fail: "degree", val: (e) => e?.max_degree },
  min_avg:    { t: "متوسط الاختبارات لا يقل عن", unit: "%", fail: "avg", val: (e) => e?.avg },
};
export const ruleList = (rules) => Object.keys(RULES).filter((k) => rules?.[k] != null && rules[k] !== "");

/** حالة الإعلان: مسودة، لم يبدأ، مفتوح، مغلق للتقديم، النتائج معلنة، ملغى */
export function callStatus(c, today = todayISO()) {
  if (c.cancelled_at) return { k: "cancelled", t: "ملغى", c: "bg-canvas text-faint" };
  if (!c.published) return { k: "draft", t: "مسودة", c: "bg-canvas text-muted" };
  if (c.results_at) return { k: "done", t: "النتائج معلنة", c: "bg-present/10 text-present" };
  if (today < c.opens_on) return { k: "soon", t: "يُفتح قريبًا", c: "bg-excused/10 text-excused" };
  if (today <= c.closes_on) return { k: "open", t: "التقديم مفتوح", c: "bg-mint-tint text-mint-deep" };
  return { k: "closed", t: "أُغلق التقديم", c: "bg-late/10 text-late" };
}

export const totalScore = (scores, criteria) =>
  (criteria ?? []).reduce((a, k) => a + (Number(scores?.[k.id]) || 0), 0);
export const maxScore = (criteria) => (criteria ?? []).reduce((a, k) => a + (Number(k.max) || 0), 0);

const fmtWhen = (ts) => new Date(ts).toLocaleString("ar-SA-u-nu-latn-ca-gregory",
  { weekday: "long", day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit" });

/** إشعار موعد المقابلة ومكانها لكل مرشح وولي أمره */
export async function notifyInterviews(call, apps) {
  for (const a of apps) {
    if (!a.interview_at) continue;
    await notifyUsers(a.notify ?? [], `موعد مقابلة: ${call.title}`,
      `رُشّح الطالب ${a.name} للمقابلة في «${call.title}» يوم ${fmtWhen(a.interview_at)}` +
      `${a.interview_place || call.interview_place ? ` في ${a.interview_place || call.interview_place}` : ""}. نرجو الحضور قبل الموعد بخمس دقائق.`,
      "/opportunities");
  }
}

/** إشعار النتيجة: كل طالب وولي أمره بنتيجته وحده */
export async function notifyResults(call, apps) {
  const text = {
    accepted: (n) => `نبارك قبول الطالب ${n} في «${call.title}». سيتواصل معه المسؤول لبدء المهام.`,
    reserve: (n) => `الطالب ${n} في قائمة الاحتياط في «${call.title}»، وسيُبلَّغ إن شغر مقعد.`,
    rejected: (n) => `نشكر الطالب ${n} على تقديمه في «${call.title}». لم يُقبل هذه المرة، ونتطلع لمشاركته في فرص قادمة.`,
  };
  for (const a of apps) {
    const f = text[a.stage];
    if (f) await notifyUsers(a.notify ?? [], `نتيجة الترشيح: ${call.title}`, f(a.name), "/opportunities");
  }
}
