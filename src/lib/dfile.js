import { supabase } from "./supabase";

/* =====================================================================
   ملف المعلم الرقمي — تقرير تفاعلي يفعّله المعلم ويعرضه للزائر برابط ثابت
   (supabase/teacher_dfile_*.sql، والقرارات في docs/teacher-digital-file/handoff.md).
   • teacher_dfiles: إعدادات المعلم (اللون والأقسام والجمل والبيانات والرتبة…).
   • dfile_data: أرقام التقرير من بيانات البوابة، دون أسماء طلاب.
   ===================================================================== */

export const DFILE_PHOTOS = "dfile-photos";

/* لون الملف: الأخضر لون البوابة افتراضي، والمفاتيح هي data-subject في dfile.css */
export const COLORS = [
  { key: "science", t: "أخضر", c: "#3E6350" },
  { key: "math", t: "أزرق", c: "#3A78B5" },
  { key: "islamic", t: "أزرق مخضر", c: "#2F7F7A" },
  { key: "english", t: "بنفسجي", c: "#5A5199" },
  { key: "navy", t: "كحلي", c: "#22305A" },
  { key: "arabic", t: "أحمر", c: "#8A4343" },
  { key: "social", t: "ذهبي", c: "#8C6A22" },
  { key: "slate", t: "رمادي", c: "#4A5866" },
];

export const RANKS = ["معلم ممارس", "معلم متقدم", "معلم خبير"];

/* الأقسام التي يختار المعلم إظهارها للزائر */
export const PARTS = [
  { key: "teach", t: "التخطيط والتدريس" },
  { key: "results", t: "النتائج" },
  { key: "assess", t: "التقويم" },
  { key: "growth", t: "التطوير المهني" },
  { key: "wins", t: "الإنجازات" },
  { key: "elements", t: "عناصر الأداء" },
  { key: "docs", t: "الشواهد" },
];

export const ELEMENTS = [
  ["e01", "أداء الواجبات الوظيفية"], ["e02", "التفاعل مع المجتمع المهني"], ["e03", "التفاعل مع أولياء الأمور"],
  ["e04", "التنويع في استراتيجيات التدريس"], ["e05", "تحسين نتائج المتعلمين"], ["e06", "إعداد وتنفيذ خطة التعلم"],
  ["e07", "توظيف تقنيات ووسائل التعلم"], ["e08", "تهيئة بيئة تعليمية"], ["e09", "الإدارة الصفية"],
  ["e10", "تحليل النتائج وتشخيص المستويات"], ["e11", "تنوع أساليب التقويم"],
];

/* إحصاءات منصة مدرستي: يكتبها المعلم من المنصة (الجزء 4 من SQL) */
export const MADRASATI = [
  { key: "lessons", t: "الدروس المحضّرة" },
  { key: "homework", t: "الواجبات" },
  { key: "tests", t: "الاختبارات" },
  { key: "enrich", t: "الإثراءات" },
];

/* أنواع جاهزة للأنشطة، ويضيف المعلم غيرها */
export const ACTIVITY_PRESETS = {
  class: ["التعلم التعاوني", "العصف الذهني", "لعب الأدوار", "حل المشكلات", "الخرائط الذهنية", "التعلم بالاكتشاف",
    "المناقشة والحوار", "التجارب العملية", "العروض التقديمية", "المسابقات الصفية", "الألعاب التعليمية", "القراءة الموجهة"],
  extra: ["الإذاعة المدرسية", "المسابقات", "الرحلات العلمية", "المعارض", "الأندية الطلابية", "المبادرات التطوعية",
    "الأيام العالمية والمناسبات", "الورش والمحاضرات", "الأولمبياد", "البرامج الإثرائية"],
};
export const ACTIVITY_LABEL = { class: "الأنشطة الصفية", extra: "الأنشطة اللاصفية" };
export const actTotal = (list) => (list ?? []).reduce((a, x) => a + (Number(x.n) || 0), 0);

export const MODE_LABEL ={ online: "إلكتروني", omr: "ورقي بتصحيح آلي", paper: "ورقي", external: "من خارج البوابة" };
export const MODE_ORDER = ["online", "omr", "paper", "external"];
export const MODE_COLOR = { online: "var(--e04)", omr: "var(--e03)", paper: "var(--e05)", external: "var(--e09)" };
export const PERIOD_LABEL = { diagnostic: "تشخيصي", period1: "الفترة الأولى", period2: "الفترة الثانية" };

/* شرائح التقدير (gradeBands.js): b5 ممتاز … b1 ضعيف (أقل من 60) */
export const BANDS = [["b5", "ممتاز"], ["b4", "جيد جدًا"], ["b3", "جيد"], ["b2", "مقبول"], ["b1", "ضعيف"]];
export const BAND_COLOR = { b5: "#4E7D66", b4: "#3F6B99", b3: "#3E8FD1", b2: "#9A7B22", b1: "#B4661E" };

export const RATING_LABEL = { 5: "مثالي", 4: "تخطى التوقعات", 3: "وافق التوقعات", 2: "بحاجة إلى تطوير", 1: "غير مرضي" };

export const hours = (d) => Number(d?.hours_train ?? 0) + Number(d?.hours_conf ?? 0);
/* نسبة مئوية معزولة الاتجاه حتى لا تنتقل % إلى يسار الرقم داخل النص العربي */
export const pc = (n) => `\u2066${n}%\u2069`;

export const pct = (n, of) => (of ? Math.round((100 * n) / of) : 0);

/* متوسط تحسّن الفصول من أول اختبار إلى آخره */
export function avgGain(improve) {
  if (!improve?.length) return null;
  return Math.round((improve.reduce((a, c) => a + (c.last - c.first), 0) / improve.length) * 10) / 10;
}

/* جمل «قراءة في 30 ثانية» المستحقة بترتيب الأولوية، والأرقام من البيانات لحظة الفتح */
export function sentences(d, s) {
  const out = [];
  const g = d?.grades ?? {};
  const wins = (s?.other_wins ?? []).filter((w) => /المنطقة|المملكة|الوطني/.test(w.t ?? ""));
  wins.forEach((w, i) => out.push({ key: `win${i}`, icon: "win", t: w.t }));
  const gain = avgGain(g.improve);
  if (gain > 0) out.push({ key: "improve", icon: "up", t: `تحسّن متوسط طلابه ${gain} درجة من أول اختبار إلى آخره.` });
  const high = pct((g.bands?.b5 ?? 0) + (g.bands?.b4 ?? 0), g.n);
  if (g.n && high >= 50) out.push({ key: "top", icon: "ok", t: `${pc(high)} من طلابه بتقدير جيد جدًا فأعلى.` });
  if (d?.plc_led > 0) out.push({ key: "plc", icon: "users", t: "قدّم لقاءً لزملائه في مجتمع التعلم." });
  if (d?.ontime >= 90) out.push({ key: "ontime", icon: "ok", t: `منتظم في تحضير حصصه: ${pc(d.ontime)} منها في يومها.` });
  const modes = new Set((d?.quizzes ?? []).map((q) => q.mode));
  if (modes.size >= 3) out.push({ key: "modes", icon: "ok", t: `نوّع أدوات التقويم: ${modes.size} أنواع في ${d.quizzes.length} اختبارًا.` });
  if (d?.subs >= 10) out.push({ key: "subs", icon: "users", t: `غطّى ${d.subs} حصة انتظار لزملائه.` });
  if (d?.guardian_msgs >= 20) out.push({ key: "guardian", icon: "users", t: `تواصل مع أولياء الأمور ${d.guardian_msgs} مرة هذا العام.` });
  return out;
}

/* الجمل الظاهرة: اختيار المعلم مما يزال مستحقًا، وإلا أعلى ثلاث */
export function pickedSentences(d, s) {
  const all = sentences(d, s);
  const chosen = (s?.sentences ?? []).map((k) => all.find((x) => x.key === k)).filter(Boolean);
  return (chosen.length ? chosen : all).slice(0, 3);
}

/* سنوات الخبرة من سنة التعيين الهجرية والعام الدراسي النشط (مثل 1448) */
export function experience(s, year) {
  const y = parseInt(String(year ?? "").match(/\d{4}/)?.[0] ?? "", 10);
  if (!s?.appoint_year || !y || y < s.appoint_year) return null;
  return y - s.appoint_year;
}

export async function loadDfile(uid) {
  const { data, error } = await supabase.from("teacher_dfiles").select("*").eq("teacher_user_id", uid).maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadDfileData(uid) {
  const { data, error } = await supabase.rpc("dfile_data", { p_uid: uid });
  if (error) throw error;
  return data;
}

export async function photoUrl(path) {
  if (!path) return null;
  const { data } = await supabase.storage.from(DFILE_PHOTOS).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/* رسالة مفهومة حين لم تُنفَّذ ملفات SQL بعد */
export function dfileError(e) {
  return /teacher_dfiles|dfile_data|schema cache|does not exist/i.test(e?.message ?? "")
    ? "ملف المعلم الرقمي يحتاج تنفيذ ملفات supabase/teacher_dfile_1.sql و2 و3 في قاعدة البيانات مرة واحدة."
    : e?.message ?? "تعذّر التحميل.";
}
