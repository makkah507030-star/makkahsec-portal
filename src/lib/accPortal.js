// src/lib/accPortal.js
import { supabase } from "./supabase";
import { countAr, nounAr } from "./arabicCount.js";

/* =====================================================================
   شواهد جاهزة من أعمال البوابة (supabase/acc_6.sql): لكل مصدر عددُ ما سُجّل في العام النشط
   (acc_portal_counts)، والمؤشرات التي يشهد لها، وصفحته في البوابة. يظهر في «المؤشرات والشواهد»
   شاهدًا جاهزًا متى كان فيه عمل، ويُربط بالشاهد المطلوب في الخطة فيُحتسب مرفوعًا دون ملف.
   الشاهد المربوط صفّ في acc_evidence رابطه «portal:<المفتاح>». u: اسم المعدود في arabicCount.js
   (فيُكتب العدد بصيغته: «فعالية واحدة»، «3 فعاليات»، «14 فعالية»)، وever لما لا يُعدّ بالعام.
   ===================================================================== */

export const PORTAL_SOURCES = [
  { k: "events", t: "الفعاليات والبرامج المعتمدة", u: "event", to: "/events", codes: ["1-2-1-1", "1-2-1-4", "1-3-1-1", "1-3-1-3", "3-2-1-1", "3-2-1-7"] },
  { k: "event_reports", t: "تقارير تنفيذ الفعاليات", u: "report", to: "/events-reports", codes: ["1-1-1-2", "1-2-1-4", "1-3-1-3", "3-2-1-4"] },
  { k: "event_consents", t: "موافقات أولياء الأمور على مشاركة أبنائهم", u: "consent", to: "/events", codes: ["1-3-1-2"] },
  { k: "behavior", t: "نماذج السلوك والانضباط الموثقة", u: "form", to: "/behavior", codes: ["1-2-1-3", "3-2-1-5"] },
  { k: "referrals", t: "إحالات الطلاب ومعالجتها", u: "referral", to: "/referrals", codes: ["1-2-1-3", "1-5-1-1", "3-2-1-5"] },
  { k: "g_programs", t: "البرامج الإرشادية المنفذة", u: "program", to: "/guidance", codes: ["1-2-1-4", "1-5-1-2", "2-1-1-8", "3-2-1-2", "3-2-1-3"] },
  { k: "g_cases", t: "الحالات الإرشادية ومتابعتها", u: "case", to: "/guidance", codes: ["1-5-1-1", "1-5-1-2", "2-1-1-1"] },
  { k: "g_sessions", t: "الجلسات الإرشادية", u: "session", to: "/guidance", codes: ["1-5-1-2", "2-1-1-8"] },
  { k: "gifted", t: "برامج الموهوبين", u: "program", to: "/gifted", codes: ["1-2-1-5", "2-1-1-1", "2-1-1-7"] },
  { k: "mawhiba", t: "متابعة مقياس موهبة", u: "student", to: "/gifted", codes: ["1-2-1-5"] },
  { k: "nominations", t: "الترشيحات والمسابقات", u: "nomination", to: "/nominations", codes: ["1-2-1-5", "2-1-1-9"] },
  { k: "globe", t: "برامج فريق جلوب البيئي", u: "program", to: "/globe", codes: ["2-1-1-5", "2-1-1-7", "3-2-1-4"] },
  { k: "scouts", t: "تقارير الكشافة والخدمة العامة", u: "report", to: "/scouts", codes: ["3-2-1-4", "1-3-1-3"] },
  { k: "polls", t: "الاستطلاعات والتصويت", u: "poll", to: "/polls-admin", codes: ["1-3-1-1", "1-4-1-3"] },
  { k: "notifications", t: "إشعارات أولياء الأمور", u: "notice", to: "/notifications", codes: ["1-3-1-2", "2-2-1-4"] },
  { k: "notices", t: "إشعارات الفترات المنشورة للأسر", u: "notice", to: "/achievement", codes: ["2-2-1-4", "1-3-1-2"] },
  { k: "news", t: "أخبار المركز الإعلامي", u: "news", to: "/news-admin", codes: ["1-3-1-3", "1-3-1-2"] },
  { k: "media", t: "معرض صور المدرسة ومقاطعها", u: "item", to: "/media", codes: ["1-3-1-3"] },
  { k: "circulars", t: "التعاميم الواردة والصادرة", u: "circular", to: "/circulars", codes: ["1-1-1-2", "1-2-1-2"] },
  { k: "ethics", t: "الإقرار بميثاق أخلاقيات المهنة", u: "teacher", ever: true, to: "/ethics-report", codes: ["1-2-1-2"] },
  { k: "pd", t: "تقارير التطوير المهني", u: "report", to: "/pd", codes: ["1-4-1-2"] },
  { k: "plc", t: "لقاءات مجتمعات التعلم المهنية", u: "meeting", to: "/plc", codes: ["1-4-1-2", "2-1-1-3"] },
  { k: "xvisits", t: "الزيارات التبادلية بين المعلمين", u: "visit", to: "/xvisits", codes: ["1-4-1-2", "2-1-1-3"] },
  { k: "improve", t: "أهداف تحسين أداء المعلمين", u: "goal", to: "/improve", codes: ["1-4-1-2", "1-4-1-4"] },
  { k: "acc_meetings", t: "محاضر لجنة التميز", u: "minutes", to: "/accreditation?tab=team", codes: ["1-4-1-3", "1-4-1-4", "1-1-1-2"] },
  { k: "ach_meetings", t: "محاضر لجنة التحصيل", u: "minutes", to: "/ach-committee", codes: ["2-2-1-3", "1-1-1-2"] },
  { k: "attendance", t: "أيام رصد الحضور الآلي", u: "day", to: "/attendance-overview", codes: ["1-2-1-3", "3-2-1-5"] },
  { k: "class_att", t: "الحصص المرصود حضورها", u: "period", to: "/period-attendance", codes: ["1-2-1-3", "2-1-1-2"] },
  { k: "warnings", t: "إنذارات الغياب", u: "warning", to: "/attendance-overview", codes: ["1-2-1-3"] },
  { k: "excuses", t: "أعذار الغياب الموثقة", u: "excuse", to: "/absence-excuses", codes: ["1-2-1-3", "1-3-1-2"] },
  { k: "permissions", t: "الاستئذان الموثق", u: "request", to: "/permissions", codes: ["1-2-1-3", "1-5-1-1"] },
  { k: "substitute", t: "حصص الانتظار المشغولة", u: "period", to: "/substitute-report", codes: ["2-1-1-2"] },
  { k: "activities", t: "أنشطة صفية من بطاقات الأنشطة", u: "use", to: "/activities", codes: ["2-1-1-3", "2-1-1-5", "2-1-1-9"] },
  { k: "quizzes", t: "الاختبارات القصيرة وتحليل نتائجها", u: "quiz", to: "/quiz-analytics", codes: ["2-2-1-1", "2-2-1-2", "2-2-1-3", "2-1-1-4"] },
  { k: "lab", t: "حصص المعمل الرقمي", u: "period", to: "/lab", codes: ["2-1-1-4", "2-1-1-5"] },
  { k: "lab_tickets", t: "بلاغات أعطال أجهزة المعمل ومعالجتها", u: "ticket", to: "/lab", codes: ["4-2-1-2", "4-1-1-4"] },
  { k: "qudrat", t: "طلاب تدربوا في مركز التدريب (القدرات)", u: "student", to: "/qudrat/report", codes: ["3-1-1-2", "3-1-1-4", "2-1-1-6", "3-2-1-6"] },
  { k: "qudrat_mocks", t: "الاختبارات المحاكية للقدرات", u: "quiz", to: "/qudrat/report", codes: ["3-1-1-2", "3-1-1-4"] },
  { k: "qiyas", t: "نتائج الطلاب في اختبارات قياس", u: "result", ever: true, to: "/qiyas", codes: ["3-1-1-1", "3-1-1-2"] },
  { k: "national", t: "بطاقات الاختبارات الوطنية من الهيئة", u: "card", ever: true, to: "/accreditation?tab=nat", codes: ["3-1-1-1", "3-1-1-2", "3-1-1-3", "3-1-1-4"] },
];
export const PORTAL_BY = Object.fromEntries(PORTAL_SOURCES.map((s) => [s.k, s]));
/** مصادر مؤشر، ما كان فيه عمل أولًا */
export const sourcesOf = (code, counts = {}) => PORTAL_SOURCES.filter((s) => s.codes.includes(code))
  .sort((a, b) => (counts[b.k] > 0) - (counts[a.k] > 0));
/** وصف العدد: «14 فعالية هذا العام»، أو بلا «هذا العام» لما لا يُعدّ بالعام */
export const portalCount = (src, n) => `${countAr(n, src.u)}${src.ever ? "" : " هذا العام"}`;
export const portalKey = (link) => (link?.startsWith("portal:") ? link.slice(7) : null);

/** اسم المعدود وحده تحت رقم كبير */
export const portalNoun = (src, n) => `${nounAr(n, src.u)}${src.ever ? "" : " هذا العام"}`;

export async function loadPortalCounts() {
  const { data, error } = await supabase.rpc("acc_portal_counts");
  return { counts: data ?? {}, error };
}
