// src/lib/accreditation.js
import { supabase } from "./supabase";

/* =====================================================================
   قسم التقويم والاعتماد المدرسي (supabase/acc_1..3.sql): لجنة التميز ومشرفها، والمؤشرات
   الـ47 للمرحلة الثانوية الحكومية برموز تقرير الأداء المدرسي (الإصدار الثالث 1447هـ)، بلا
   مؤشرات نافس ولا المدارس الأهلية. الصياغة منقولة من تقرير المدرسة كما هي.
   ===================================================================== */

export const DOMAINS = {
  1: "الإدارة المدرسية", 2: "التعليم والتعلم", 3: "نواتج التعلم", 4: "البيئة المدرسية",
};
export const STANDARDS = {
  "1-1": "التخطيط", "1-2": "قيادة العملية التعليمية", "1-3": "المجتمع المدرسي", "1-4": "التطوير المؤسسي",
  "1-5": "حقوق المتعلم وحمايته", "2-1": "بناء خبرات التعلم", "2-2": "تقويم التعلم", "3-1": "التحصيل التعليمي",
  "3-2": "التطور الشخصي والصحي والاجتماعي", "4-1": "المبنى المدرسي", "4-2": "الأمن والسلامة",
};

export const INDICATORS = {
  "1-1-1-1": "تضع المدرسة خطة تشغيلية شاملة وفق أهداف تطويرية محددة.",
  "1-1-1-2": "تتابع المدرسة تنفيذ خططها التشغيلية وتطورها بما يضمن تحقيق أهدافها.",
  "1-2-1-1": "تعزز المدرسة القيم الإسلامية، والهوية الوطنية.",
  "1-2-1-2": "تطبق المدرسة قيم مهنة التعليم وأخلاقياتها، وتتابع الالتزام بها.",
  "1-2-1-3": "تطبق المدرسة إجراءات محددة؛ لدعم الانضباط المدرسي، وتتابع الالتزام بها.",
  "1-2-1-4": "تنفذ المدرسة برامج وأنشطة تربوية داعمة للسلوك الإيجابي لدى المتعلمين، ومنهم ذوو الإعاقة والموهوبون، وتتابعها.",
  "1-2-1-5": "تنفذ المدرسة برامج وأنشطة إثرائية؛ لتطوير مواهب المتعلمين، وتهيئهم للمستقبل، وتتابعها.",
  "1-3-1-1": "تعزز المدرسة بناء العلاقات الإيجابية والتعاون في المجتمع المدرسي.",
  "1-3-1-2": "تعزز المدرسة مشاركة الأسرة في تعلم أبنائهم، والتحضير لمستقبلهم.",
  "1-3-1-3": "تعزز المدرسة الشراكة المجتمعية؛ لدعم التعلم والتأثير الإيجابي في المجتمع.",
  "1-4-1-1": "تدعم المدرسة منسوبيها للحصول على الرخصة المهنية، وتتابعها.",
  "1-4-1-2": "تدعم المدرسة التطوير المهني لمنسوبيها وفقًا لنتائج التقويم وتحليل احتياجاتهم.",
  "1-4-1-3": "تطبق المدرسة التقويم الذاتي المبني على المعايير المعتمدة من الهيئة بشكل مستمر.",
  "1-4-1-4": "تنفذ المدرسة خطة التحسين بناء على نتائج التقويم المدرسي، وتتابعها.",
  "1-5-1-1": "تلتزم المدرسة بالمحافظة على حقوق المتعلمين، وحمايتهم.",
  "1-5-1-2": "توفر المدرسة مناخًا آمنًا للتعلم والنمو نفسيًا واجتماعيًا.",
  "2-1-1-1": "توفر المدرسة فرصًا متكافئة للتعلم تلبي احتياجات المتعلمين، ومنهم ذوو الإعاقة والموهوبون.",
  "2-1-1-2": "تدعم المدرسة تنفيذ المناهج بما يحقق نواتج التعلم المستهدفة.",
  "2-1-1-3": "تنوع المدرسة في استراتيجيات التعليم والتعلم؛ لتلبية احتياجات المتعلمين، ودعم تعلمهم.",
  "2-1-1-4": "تفعل المدرسة التقنية الرقمية؛ لدعم تعلم المتعلمين وتلبية احتياجاتهم.",
  "2-1-1-5": "تنفذ المدرسة أنشطة تعلم تطبيقية ترتبط بحياة المتعلمين.",
  "2-1-1-6": "تنمي المدرسة المهارات القرائية والعددية الأساسية لدى المتعلمين.",
  "2-1-1-7": "تنمي المدرسة مهارات التفكير والبحث والابتكار لدى المتعلمين.",
  "2-1-1-8": "تنمي المدرسة المهارات العاطفية والاجتماعية لدى المتعلمين.",
  "2-1-1-9": "تعزز المدرسة دافعية المتعلمين للتعلم، والاستمتاع به.",
  "2-2-1-1": "تطبق المدرسة أساليب وأدوات تقويم متنوعة؛ للكشف عن مستويات أداء المتعلمين المختلفة.",
  "2-2-1-2": "تطبق المدرسة أساليب وأدوات متنوعة؛ لتقويم نواتج التعلم المستهدفة في مناهج التعليم.",
  "2-2-1-3": "تحلل المدرسة نتائج التقويم، وتوظفها في تحسين عمليات التعليم والتعلم والتقويم.",
  "2-2-1-4": "تقدم المدرسة التغذية الراجعة للمتعلمين وأولياء أمورهم، وتتابع تقدمهم بشكل مستمر.",
  "3-1-1-1": "يحقق المتعلمون نتائج متقدمة في الاختبارات التحصيلية للمرحلة الثانوية.",
  "3-1-1-2": "يحقق المتعلمون نتائج متقدمة في اختبارات القدرات العامة للمرحلة الثانوية.",
  "3-1-1-3": "يحقق المتعلمون تقدمًا في الاختبار التحصيلي قياسًا على مستوى أداء المدرسة السابق.",
  "3-1-1-4": "يحقق المتعلمون تقدمًا في اختبار القدرات العامة قياسًا على مستوى أداء المدرسة السابق.",
  "3-2-1-1": "يظهر المتعلمون الاعتزاز بالقيم والهوية الوطنية.",
  "3-2-1-2": "يظهر المتعلمون اتجاهات إيجابية نحو ذواتهم والآخرين.",
  "3-2-1-3": "يظهر المتعلمون التزامًا بالممارسات الصحية السليمة.",
  "3-2-1-4": "يشارك المتعلمون في الأنشطة المجتمعية والأعمال التطوعية.",
  "3-2-1-5": "يلتزم المتعلمون بقواعد السلوك والانضباط المدرسي.",
  "3-2-1-6": "يظهر المتعلمون الاستقلالية، والقدرة على التعلم الذاتي.",
  "3-2-1-7": "يظهر المتعلمون اعتزازًا بثقافتهم واحترامًا للتنوع الثقافي في المجتمع.",
  "4-1-1-1": "توفر المدرسة مبنى تعليمي يستوفي المواصفات والاشتراطات المعتمدة من حيث النوع والخدمات المساندة.",
  "4-1-1-2": "تنظيم مبنى المدرسة ملائم لعدد المتعلمين وخصائص المرحلة العمرية، ومنهم ذوو الإعاقة.",
  "4-1-1-3": "تتوافر فصول ومعامل ملائمة للعملية التعليمية تلبي احتياجات المتعلمين، ومنهم ذوو الإعاقة.",
  "4-1-1-4": "تلبي المرافق والتجهيزات والخدمات المساندة احتياجات المتعلمين، ومنهم ذوو الإعاقة.",
  "4-2-1-1": "تتوافر في مبنى المدرسة ومرافقها جميع متطلبات الأمن والسلامة.",
  "4-2-1-2": "تتابع المدرسة صيانة المبنى وجميع مرافقه وتجهيزاته بشكل دوري.",
  "4-2-1-3": "تتابع المدرسة نظافة المبنى المدرسي وجميع مرافقه بشكل مستمر.",
};
export const CODES = Object.keys(INDICATORS);
export const domainOf = (code) => Number(code[0]);
export const stdOf = (code) => code.slice(0, 3);
export const NEW_CODES = ["3-1-1-3", "3-1-1-4"];   // مستحدثان في الإصدار الثالث بلا قياس سابق

// مستويات الأداء في الدليل
export const LEVELS = [
  { min: 90, t: "التميز", c: "#2E8B57", chip: "bg-present/10 text-present" },
  { min: 75, t: "التقدم", c: "#3B6FB6", chip: "bg-excused/10 text-excused" },
  { min: 50, t: "الانطلاق", c: "#E08A3C", chip: "bg-late/10 text-late" },
  { min: 0, t: "التهيئة", c: "#C0392B", chip: "bg-absent/10 text-absent" },
];
export const levelOf = (v) => (v == null ? null : LEVELS.find((l) => v >= l.min));
export const PLAN_BELOW = 75;   // ما دون التقدم يدخل الخطة

const avg = (a) => { const x = a.filter((v) => v != null); return x.length ? Math.round((x.reduce((s, v) => s + v, 0) / x.length) * 100) / 100 : null; };
/** تحليل النسب: المتوسط العام والمجالات والمعايير والتوزيع على المستويات والأدنى والأعلى */
export function analyze(scores = {}) {
  const has = CODES.filter((c) => scores[c] != null);
  const byDomain = Object.fromEntries(Object.keys(DOMAINS).map((d) => [d, avg(CODES.filter((c) => domainOf(c) === +d).map((c) => scores[c]))]));
  const byStd = Object.fromEntries(Object.keys(STANDARDS).map((s) => [s, avg(CODES.filter((c) => stdOf(c) === s).map((c) => scores[c]))]));
  const dist = LEVELS.map((l) => ({ ...l, n: has.filter((c) => levelOf(scores[c]) === l).length }));
  const sorted = [...has].sort((a, b) => scores[a] - scores[b]);
  // الأداء العام الرسمي كما في التقرير (_overall) مقدَّم على المحسوب، فطريقة الهيئة في الترجيح قد تختلف قليلًا
  const calc = avg(Object.values(byDomain));
  return { measured: has.length, overall: scores._overall ?? calc, calc, official: scores._overall != null, byDomain, byStd, dist,
    low: sorted.slice(0, 5), high: sorted.slice(-4).reverse(), below: sorted.filter((c) => scores[c] < PLAN_BELOW) };
}

export const TOOLS = [
  { key: "docs", t: "تحليل الوثائق والسجلات" },
  { key: "q_students", t: "استبانة الطلاب" },
  { key: "q_teachers", t: "استبانة المعلمين" },
  { key: "q_family", t: "استبانة الأسر" },
  { key: "obs_class", t: "الملاحظة الصفية", hint: "15 ملاحظة على الأقل" },
  { key: "obs_env", t: "ملاحظة البيئة المدرسية" },
  { key: "int_students", t: "مقابلة الطلاب" },
  { key: "int_teachers", t: "مقابلة المعلمين" },
  { key: "int_counselor", t: "مقابلة الموجه الطلابي" },
  { key: "int_admin", t: "مقابلة الإدارة المدرسية" },
  { key: "tests", t: "نتائج القدرات والتحصيلي" },
  { key: "licenses", t: "الرخص المهنية" },
];
// الحد الأدنى لعينة الاستبانات حسب عدد الطلاب (الطلاب، المعلمون، الأسر)
export function sampleMin(students) {
  const [s, t, f] = students < 100 ? [50, 70, 25] : students <= 300 ? [40, 60, 15] : [30, 50, 10];
  return { q_students: s, q_teachers: t, q_family: f };
}

export const PHASES = {
  self: [
    { t: "الإعداد", steps: ["تشكيل فريق التقويم الذاتي", "تدريب الفريق على الدليل والأدوات", "مراجعة نتائج الدورة السابقة", "إعداد خطة التقويم الذاتي وجدولها", "توعية منسوبي المدرسة والأسر"] },
    { t: "التنفيذ", steps: ["التسجيل في منصة تميز", "تعبئة نموذج الجاهزية", "تطبيق أدوات التقويم"] },
    { t: "الإغلاق", steps: ["إدخال البيانات في المنصة", "حفظ ملف التقويم الذاتي", "إغلاق الأدوات", "بناء خطة التحسين", "رفع خطة التحسين"] },
  ],
  external: [
    { t: "قبل الزيارة", steps: ["استلام إشعار الزيارة وموعدها", "تجهيز ملف الشواهد حسب المؤشرات", "تهيئة المنسوبين والطلاب والأسر"] },
    { t: "الزيارة", steps: ["استقبال فريق التقويم الخارجي", "تيسير المقابلات والملاحظات", "توفير الوثائق المطلوبة"] },
    { t: "بعد الزيارة", steps: ["استلام تقرير التقويم الخارجي ورفعه", "تحليل التقرير ومقارنته بالتقويم الذاتي", "تحديث خطة التحسين واعتمادها"] },
  ],
};

export const REPORT_KIND = { self: "تقرير التقويم الذاتي", external: "تقرير التقويم الخارجي", plan: "خطة التحسين المرفوعة" };
export const EV_STATUS = { collected: { t: "مجموع", c: "bg-canvas text-muted" }, reviewed: { t: "مراجَع", c: "bg-excused/10 text-excused" }, approved: { t: "معتمد", c: "bg-present/10 text-present" } };

/** الحالة: صلاحيتي في القسم */
export async function loadAccMe() {
  const { data, error } = await supabase.rpc("acc_me");
  if (error) return { err: error, me: null };
  return { me: data };
}
export const setupMsg = (e) => (/acc_|schema cache|does not exist/.test(e?.message ?? "")
  ? "القسم لم يُفعّل بعد: شغّل ملفات supabase/acc_1.sql إلى acc_3.sql في Supabase ← SQL Editor." : e?.message ?? "تعذّر التحميل.");

export const ACC_BUCKET = "accreditation";
const ext = (name) => (/\.([a-z0-9]{1,5})$/i.exec(name ?? "")?.[1] ?? "bin").toLowerCase();
/** رفع ملف شاهد (تحت رمز مؤشره) أو تقرير (تحت reports/) إلى المخزن الخاص */
export async function accUpload(folder, file) {
  const path = `${folder}/${crypto.randomUUID()}.${ext(file.name)}`;
  const { error } = await supabase.storage.from(ACC_BUCKET).upload(path, file, { contentType: file.type || undefined });
  return { path: error ? null : path, error };
}
/** فتح ملف من المخزن الخاص برابط مؤقت */
export async function accOpen(path) {
  const w = window.open("", "_blank");
  const { data, error } = await supabase.storage.from(ACC_BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) { w?.close(); return error ?? new Error("تعذّر فتح الملف"); }
  if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  return null;
}

// قياس نواتج البرنامج: نسبة ما نُفّذ من بنوده، ونسبة ما تحققت أهدافه
export function progOf(p) {
  const m = p.methods ?? [];
  const k = (f) => (m.length ? Math.round((m.filter(f).length / m.length) * 100) : 0);
  return { total: m.length, done: k((x) => x.done === true), met: k((x) => x.met === true),
    touched: m.some((x) => x.done != null || x.level || x.met != null) };
}
export const LEVEL_T = { high: "مرتفع", mid: "متوسط", low: "منخفض" };
export const PLAN_STATUS = { draft: { t: "مسودة", c: "bg-late/10 text-late" }, active: { t: "السارية", c: "bg-present/10 text-present" }, archived: { t: "مؤرشفة", c: "bg-canvas text-muted" } };
export const fmtPct = (v) => (v == null ? "—" : `${Number(v)}%`);

export const roleT = (m) => (m.role === "coordinator" ? "مشرف اللجنة" : m.domains?.length ? "مشرف مجال" : "عضو");

/** بيانات القسم للتقارير: برامج الخطة السارية وكل الشواهد والمحاضر ونتائج الاختبارات الوطنية */
export async function loadAccData(plans) {
  const plan = plans.find((p) => p.status === "active") ?? plans[0] ?? null;
  const [pg, ev, mt, nat] = await Promise.all([
    plan ? supabase.from("acc_programs").select("*").eq("plan_id", plan.id) : Promise.resolve({ data: [] }),
    supabase.from("acc_evidence").select("*").order("created_at", { ascending: false }),
    supabase.from("acc_meetings").select("*").order("held_on", { ascending: false }),
    supabase.from("acc_national").select("*").order("academic_year"),   // قبل acc_5.sql يفشل فتُعدّ فارغة
  ]);
  return { plan, progs: pg.data ?? [], ev: ev.data ?? [], meetings: mt.data ?? [], nat: nat.data ?? [] };
}

/** الشواهد المطلوبة في برامج الخطة وما رُفع منها: يُعدّ الشاهد مرفوعًا إن رُفع للمؤشر شاهد بعنوانه */
export function evidenceGaps(codes, progs, ev) {
  const up = {}; ev.forEach((e) => { (up[e.code] ??= []).push(e); });
  const missing = [];
  for (const c of codes) {
    const p = progs.find((x) => x.code === c && x.kind === "plan");
    const titles = new Set((up[c] ?? []).map((e) => e.title.trim()));
    (p?.evidence ?? []).forEach((t) => { if (!titles.has(t.trim())) missing.push({ code: c, title: t }); });
    if (!p?.evidence?.length && !(up[c]?.length)) missing.push({ code: c, title: null });
  }
  const required = codes.reduce((s, c) => s + (progs.find((x) => x.code === c && x.kind === "plan")?.evidence?.length ?? 0), 0);
  return { up, missing, required, uploaded: codes.reduce((s, c) => s + (up[c]?.length ?? 0), 0) };
}

/** ملخص مجال أو مجموعة مجالات: المؤشرات ونسبها، والبرامج وإنجازها، والشواهد وفجواتها */
export function domainSummary(domains, { progs, ev, scores = {} }) {
  const codes = CODES.filter((c) => domains.includes(domainOf(c)));
  const inPlan = progs.filter((p) => p.kind === "plan" && domains.includes(p.domain));
  const sustain = progs.filter((p) => p.kind === "sustain" && domains.includes(p.domain));
  const evs = ev.filter((e) => domains.includes(e.domain));
  const gaps = evidenceGaps(codes, progs, evs);
  const done = inPlan.length ? Math.round(inPlan.reduce((s, p) => s + progOf(p).done, 0) / inPlan.length) : 0;
  const met = inPlan.length ? Math.round(inPlan.reduce((s, p) => s + progOf(p).met, 0) / inPlan.length) : 0;
  const vals = codes.map((c) => scores[c]).filter((v) => v != null);
  const perf = vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100 : null;
  const approved = evs.filter((e) => e.status === "approved").length;
  return { codes, inPlan, sustain, evs, gaps, done, met, perf, approved };
}

// لون لكل مجال في الشواهد وعارضها وبطاقات المؤشرات
export const DOMAIN_COLOR = { 1: "#2F5D8A", 2: "#2E7D6B", 3: "#9A6A1F", 4: "#7A4FB5" };
// نوع ملف الشاهد من امتداده: pdf أو image أو other
export const fileKind = (path) => (/\.pdf$/i.test(path ?? "") ? "pdf" : /\.(png|jpe?g|webp|gif|bmp)$/i.test(path ?? "") ? "image" : "other");
