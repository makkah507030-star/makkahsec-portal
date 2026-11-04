import { supabase } from "./supabase";
import { countAr } from "./arabicCount.js";

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
  { key: "quote", t: "رأي الإدارة" },
  { key: "teach", t: "التخطيط والتدريس" },
  { key: "records", t: "السجلات والنماذج" },
  { key: "lab", t: "المعمل الرقمي" },
  { key: "results", t: "النتائج" },
  { key: "assess", t: "التقويم" },
  { key: "growth", t: "التطوير المهني" },
  { key: "impact", t: "أثر التطوير" },
  { key: "wins", t: "الإنجازات" },
  { key: "elements", t: "عناصر الأداء" },
  { key: "docs", t: "الشواهد" },
];

/* ملف محضر المعمل الرقمي (supabase/lab_dfile_*.sql): أقسامه التي يختار إظهارها، وعناصر نموذج «محضر المختبر» */
export const LAB_PARTS = [
  { key: "run", t: "تشغيل المعمل" },
  { key: "devices", t: "الأجهزة والصيانة" },
  { key: "safety", t: "السلامة" },
  { key: "digital", t: "المعمل الرقمي" },
  { key: "wins", t: "الإنجازات" },
  { key: "elements", t: "عناصر الأداء" },
  { key: "docs", t: "الشواهد" },
];
/* الملف الرقمي للموظف (supabase/staff_dfile_*.sql): الوكيل والموجه الطلابي ومحضر مختبر العلوم */
export const STAFF_PARTS = [
  { key: "work", t: "العمل في البوابة" },
  { key: "wins", t: "الإنجازات" },
  { key: "elements", t: "عناصر الأداء" },
  { key: "docs", t: "الشواهد" },
];
export const LAB_ELEMENTS = [
  ["l01", "أداء الواجبات الوظيفية"], ["l02", "التفاعل مع المجتمع المهني"], ["l03", "التفاعل مع أولياء الأمور"],
  ["l04", "التنويع في استراتيجيات التدريس"], ["l05", "تحسين نتائج المتعلمين"], ["l06", "خطة يومية لأنشطة المختبر"],
  ["l07", "المعرفة بالأسس والمفاهيم الفنية"], ["l08", "توفير المستلزمات اللازمة"], ["l09", "سياسات وإجراءات السلامة المهنية"],
  ["l10", "تحضير المختبر وتجهيزه"], ["l11", "تهيئة الأجهزة وتسليمها وتخزينها"], ["l12", "تقرير أنشطة المختبر الأسبوعية"],
  ["l13", "تقارير دورية عن حالة الأجهزة"],
];
// لون عنصر المحضر: بألوان عناصر المعلم بالترتيب، والأخيران إضافيان
export const labElColor = (k) => ({ l12: "#7a6a3a", l13: "#4f6f8f" }[k] ?? `var(--${k.replace(/^l/, "e")})`);

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

/* «السجلات والنماذج» (supabase/teacher_dfile_8.sql): أسماء السجلات الآلية من البوابة،
   وبطاقات جاهزة لما يضيفه المعلم من سجلات ورقية أو خارجية */
export const RECORD_AUTO = {
  attendance: "سجل التحضير والحضور بالحصة",
  followup: "سجل المتابعة الإلكتروني",
  grades: "سجل رصد الدرجات",
  quizzes: "سجل الاختبارات وتحليل النتائج",
  plans: "الخطط العلاجية والإثرائية",
  subs: "سجل حصص الانتظار",
  guardians: "سجل التواصل مع أولياء الأمور",
};
export const RECORD_PRESETS = ["سجل الطلاب المتعثرين", "سجل الطلاب المتميزين", "ملف الأنشطة", "سجل الواجبات الورقي",
  "دفتر التحضير الورقي", "ملف الإنجاز", "سجل الملاحظة الصفية", "سجل الزيارات التبادلية", "ملف المادة"];

/* أنواع جاهزة للأنشطة، ويضيف المعلم غيرها */
export const ACTIVITY_PRESETS = {
  class: ["التعلم التعاوني", "العصف الذهني", "لعب الأدوار", "حل المشكلات", "الخرائط الذهنية", "التعلم بالاكتشاف",
    "المناقشة والحوار", "التجارب العملية", "العروض التقديمية", "المسابقات الصفية", "الألعاب التعليمية", "القراءة الموجهة"],
  extra: ["الإذاعة المدرسية", "المسابقات", "الرحلات العلمية", "المعارض", "الأندية الطلابية", "المبادرات التطوعية",
    "الأيام العالمية والمناسبات", "الورش والمحاضرات", "الأولمبياد", "البرامج الإثرائية"],
};
export const ACTIVITY_LABEL = { class: "الأنشطة الصفية", extra: "الأنشطة اللاصفية" };
export const actTotal = (list) => (list ?? []).reduce((a, x) => a + (Number(x.n) || 0), 0);

export const MODE_LABEL ={ online: "إلكتروني", offline: "دون إنترنت", omr: "ورقي بتصحيح آلي", paper: "ورقي", external: "من خارج البوابة" };
export const MODE_ORDER = ["online", "offline", "omr", "paper", "external"];
export const MODE_COLOR = { online: "var(--e04)", offline: "var(--e07)", omr: "var(--e03)", paper: "var(--e05)", external: "var(--e09)" };
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
  if (modes.size >= 3) out.push({ key: "modes", icon: "ok", t: `نوّع أدوات التقويم: ${countAr(modes.size, "evalType")} في ${countAr(d.quizzes.length, "quiz", { acc: true })}.` });
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

/** قسم المعمل الرقمي ومعمل الحاسب (supabase/dfile_lab.sql) بكود الملف؛ null قبل تشغيل الملف أو بلا عمل في المعمل */
export async function loadDfileLab(code) {
  if (!code) return null;
  const { data, error } = await supabase.rpc("dfile_lab", { p_code: code });
  return error ? null : data;
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

/* ===== الرابط العام والزوار (supabase/teacher_dfile_5.sql) ===== */

/* رابط الزائر الثابت. الرمز يحمل q=1 ليُعرف أن الزائر فتحه بالمسح، ورسالة واتساب w=1 */
export const dfileLink = (code, via = false) =>
  `${window.location.origin}/f/${code}${via === true || via === "qr" ? "?q=1" : via === "wa" ? "?w=1" : ""}`;

/* الكلمة الترحيبية الافتراضية لمشاركة الملف عبر واتساب (يعدّلها المعلم وتُحفظ في share_msg) */
export const SHARE_MSG = "السلام عليكم ورحمة الله وبركاته،\n"
  + "يسعدني اطلاعكم على ملفي الرقمي في بوابة مكة الثانوية الرقمية، "
  + "وأتشرف بملاحظاتكم وتوجيهاتكم في سجل الزوار داخل الملف، فهي محل تقديري واهتمامي.";

const publicFn = (code) => (isLabCode(code) ? "lab_dfile_public" : isStaffCode(code) ? "staff_dfile_public" : "dfile_public");
export async function loadPublic(code) {
  const { data, error } = await supabase.rpc(publicFn(code), { p_code: code });
  if (error) throw error;
  return data;
}

/* ملف محضر المعمل: رمزه يبدأ بـ ML- (supabase/lab_dfile_*.sql) */
export const isLabCode = (code) => /^ML-/i.test(String(code ?? "").trim());
/* ملف الموظف (الوكيل والموجه ومحضر العلوم): رمزه يبدأ بـ MW- (supabase/staff_dfile_*.sql) */
export const isStaffCode = (code) => /^MW-/i.test(String(code ?? "").trim());

export async function visitStart(code, name, org, via) {
  const fn = isLabCode(code) ? "lab_dfile_visit_start" : isStaffCode(code) ? "staff_dfile_visit_start" : "dfile_visit_start";
  const { data } = await supabase.rpc(fn, { p_code: code, p_name: name ?? "", p_org: org ?? "", p_via: via });
  return data ?? null;
}

/* ملاحظة الزائر في سجل الزوار (supabase/teacher_dfile_7.sql) */
export async function visitNote(id, note) {
  const { data, error } = await supabase.rpc("dfile_visit_note", { p_id: id, p_note: note ?? "" });
  if (error) throw new Error(/dfile_visit_note|schema cache/i.test(error.message) ? "حفظ الملاحظات غير مفعّل بعد." : error.message);
  return data === true;
}

export function visitPing(id, seconds) {
  if (!id) return;
  supabase.rpc("dfile_visit_ping", { p_id: id, p_seconds: Math.round(seconds) }).then(() => {}, () => {});
}

/** زوار الملف. kind: «teacher» لملف المعلم، و«lab» لملف محضر المعمل (supabase/lab_dfile_1.sql)، و«staff» لملف الموظف */
export async function loadVisits(uid, kind = "teacher") {
  const { data } = await supabase.from("dfile_visits").select("*")
    .eq("teacher_user_id", uid).order("started_at", { ascending: false }).limit(100);
  return (data ?? []).filter((v) => (v.kind ?? "teacher") === kind).slice(0, 50);
}

export const STOP_REASONS = ["نقل من المدرسة", "تقاعد", "تحويل إلى عمل إداري"];

/* ===== شواهد المعلم المرفوعة: رابط مؤقت عبر netlify/functions/dfile-doc.js ===== */
export async function openDoc(code, id) {
  const r = await fetch("/.netlify/functions/dfile-doc", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, id }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error(j.error || "تعذّر فتح الشاهد");
  return j.url;
}

/* ===== رأي الإدارة (supabase/teacher_dfile_6.sql) ===== */
export const OPINION_ROLE = { principal: "مدير المدرسة", deputy_academic: "وكيل الشؤون التعليمية" };

export async function loadMyOpinions(uid) {
  const { data } = await supabase.from("dfile_opinions").select("id, author_role, author_name, body, written_at, decision")
    .eq("teacher_user_id", uid).order("author_role", { ascending: false });
  return data ?? [];
}
export const decideOpinion = (id, show) => supabase.rpc("dfile_opinion_decide", { p_id: id, p_show: show });

/* ===== الأسبوع الدراسي ===== */
const WEEK_WORDS = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر",
  "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر", "التاسع عشر", "العشرون"];
/* أيام الأسبوع الدراسي لدروس الأسبوع المكتوبة يدويًا (DfileDistribution) */
export const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
export const weekWord = (n) => WEEK_WORDS[n] ?? String(n);

/* ===== المواد من الجدول الدراسي: مادة وصفّ وفصولها (courses في dfile_data) ===== */
const GRADE = { 1: "الأول الثانوي", 2: "الثاني الثانوي", 3: "الثالث الثانوي" };
/* اسم المادة كما في الجدول، ومعه الصف إن لم يكن في الاسم رقم يدل عليه */
export const courseLabel = (c) => (/\d/.test(c.subject) ? c.subject : `${c.subject} (${GRADE[c.grade] ?? ""})`);
export const subjectsOf = (d) => [...new Set((d?.courses ?? []).map(courseLabel))];
