import { supabase } from "./supabase.js";
import { shrinkImage } from "./imageResize.js";
import { loadActiveTerm } from "./officialAttendance.js";

/* =====================================================================
   ملف الأداء الوظيفي للمعلم — البيانات المشتركة بين صفحة المعلم وصفحة المدير
   (supabase/teacher_performance.sql). أُلغي زر «إرسال إلى ملف الشواهد» من النماذج:
   الشواهد تُجمع تلقائيًا، وبطاقات البنود تشرح مصدر كل شاهد.
   • البند العادي: شاهد واحد وعداد (use_count).
   • بنود سجل التطوير المهني (is_record): كل مشاركة شاهد مستقل، والعدد = عددها.
   • «أداء الواجبات الوظيفية» للمقيِّم فقط: لا شواهد له.
   ===================================================================== */

export const PERF_BUCKET = "perf-evidence";

/* ساعات التطوير في التقارير: ساعات الحضور وحدها — حضور البرامج التدريبية (2-2) وحضور
   المؤتمرات (2-5) — دون ساعات تنفيذ المعلم برنامجًا لزملائه (2-1) */
// وللموظفين غير المعلمين بند البرامج التدريبية الذي يرفعونه بأنفسهم: محضر المعمل والموجه والوكيل والمدير ومحضر العلوم
export const ATTEND_HOUR_ITEMS = ["e02_02", "e02_05", "l02_01", "g02_01", "d02_01", "m02_01", "s02_01"];
export const attendHours = (rows) => (rows ?? [])
  .filter((r) => ATTEND_HOUR_ITEMS.includes(r.item_key)).reduce((a, r) => a + (Number(r.hours) || 0), 0);
export const MAX_BYTES = 5 * 1024 * 1024;
export const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";
export const SOURCE_LABEL = { upload: "مرفوع", form: "نموذج", visit: "زيارة دعم", plc: "مجتمع تعلم", xvisit: "زيارة تبادلية", pd: "نموذج تطوير" };

/* لون مميّز لكل عنصر — درجات هادئة تنسجم مع أخضر الهوية، بإضاءة متقاربة
   فيبقى النص الأبيض والعناوين مقروءة. عنصر المقيِّم رمادي محايد. */
export const ELEMENT_COLOR = {
  e01: "#6b6b6b", e02: "#3e6350", e03: "#2f7f7a", e04: "#3f6b99", e05: "#5a5f9e", e06: "#7a5c99",
  e07: "#9a4f6e", e08: "#a5523f", e09: "#b07a2a", e10: "#7d7f2a", e11: "#5f8a3a",
};
// عناصر الموظفين الآخرين (l, s, g, d, a + رقم) بألوان عناصر المعلم نفسها بالترتيب، وما بعد الحادي عشر بألوان إضافية
const EXTRA = ["#7a6a3a", "#4f6f8f", "#6f5a8a", "#3f7f5f", "#8a5a4a", "#4a6f7f", "#7f6f3f", "#5a7a4a"];
export const elementColor = (key) => {
  if (ELEMENT_COLOR[key]) return ELEMENT_COLOR[key];
  const n = Number(String(key).slice(1));
  if (!n) return "#3e6350";
  return n <= 11 ? ELEMENT_COLOR[`e${String(n).padStart(2, "0")}`] : EXTRA[(n - 12) % EXTRA.length];
};

/* ملفات الأداء غير المعلم (supabase/lab_perf_*.sql و staff_perf_*.sql): نموذج كل وظيفة في الدليل وأدوارها.
   activity: رائد النشاط متفرغ للنشاط ويعامل معاملة الإداريين: الجزء العام من نموذجه (عناصر المعلم الأحد عشر، 70%)
   بطاقة واحدة يقدّرها مدير المدرسة دون شواهد، والعناصر الأربعة الخاصة بالنشاط (30%) بشواهدها. */
export const PERF_TRACKS = {
  principal: { roles: ["principal"], label: "مدير المدرسة", who: "المدير", form: "مدير المدرسة (8)" },
  lab:       { roles: ["computer_lab"], label: "محضر معمل الحاسب الآلي", who: "المحضر", form: "محضر المختبر (5)" },
  science:   { roles: ["science_labs", "science_labs_2", "science_labs_3"], label: "محضر مختبر العلوم", who: "المحضر", form: "محضر المختبر (5)" },
  counselor: { roles: ["counselor_1", "counselor_2", "counselor_3"], label: "الموجه الطلابي", who: "الموجه", form: "الموجه الطلابي (6)" },
  deputy:    { roles: ["deputy_academic", "deputy_school", "deputy_students"], label: "وكيل المدرسة", who: "الوكيل", form: "وكيل المدرسة (7)" },
  activity:  { roles: ["activity_leader"], label: "رائد النشاط", who: "رائد النشاط", form: "معلم مسند له نشاط طالبي (2)" },
};
// أوزان عناصر المعلم في نموذج رائد النشاط (2)
const ACTIVITY_WEIGHTS = { e01: 10, e02: 10, e03: 10, e04: 5, e05: 5, e06: 5, e07: 5, e08: 5, e09: 5, e10: 5, e11: 5 };
/** مسار ملف الأداء لأدوار المستخدم (أول وظيفة يحملها من غير المعلم)، أو null */
export const perfTrackOf = (adminRoles = []) =>
  Object.entries(PERF_TRACKS).find(([, t]) => t.roles.some((r) => adminRoles.includes(r)))?.[0] ?? null;

/* حالة البند في البوابة (perf_items.portal — supabase/teacher_performance_portal.sql) */
export const PORTAL_TAG = {
  auto:    { t: "يصل تلقائيًا من عملك في البوابة", c: "bg-mint-light text-mint-deep" },
  partial: { t: "متوفر جزئيًا في البوابة · أكمله برفع شاهد", c: "bg-canvas text-muted" },
  manual:  { t: "يُرفع يدويًا الآن · سيكون متاحًا في البوابة قريبًا", c: "bg-warning-light text-warning" },
  record:  { t: "سجل التطوير المهني: كل مشاركة بشاهدها", c: "bg-mint-tint text-mint-deep" },
  // غير المعلمين (المحضرون والموجه والوكيل والمدير) بلا وحدة «التطوير المهني»: يرفعون مشاركاتهم بأنفسهم
  recordManual: { t: "يُرفع يدويًا: كل برنامج أو مشاركة بشهادتها وساعاتها", c: "bg-mint-tint text-mint-deep" },
  judge:   { t: "يقدّره المقيِّم بالملاحظة، ويمكنك رفع شاهد", c: "bg-canvas text-muted" },
};

/** علامات صاحب الملف: أدواره الإدارية، وcult_team إن كان في فريق الثقافة المؤسسية (supabase/cult_7.sql).
    بنود الوكيل تختلف بمجال عمله، وبند أعمال فريق الثقافة لأعضائه (perf_items.roles) */
export async function loadOwnerRoles(uid) {
  const { data, error } = await supabase.rpc("perf_owner_tags", { p_uid: uid });
  if (!error) return data ?? [];
  const { data: r } = await supabase.from("admin_roles").select("role_type").eq("user_id", uid);
  return (r ?? []).map((x) => x.role_type);
}
/** بنود العناصر التي تخص أدوار صاحب الملف: البند بلا roles للجميع، وإلا لمن يحمل أحدها */
export const itemsForRoles = (els, roles) => els.map((e) => ({
  ...e, items: e.items.filter((i) => !i.roles?.length || i.roles.some((r) => roles.includes(r))),
}));

let refCache = null;
/** العناصر وبنودها مرتبة، مع بنود كل عنصر في elements[i].items.
    track: «teacher» لنموذج المعلم، و«lab» لنموذج محضر معمل الحاسب (supabase/lab_perf_1.sql) */
export function loadPerfReference(track = "teacher", tags = []) {
  return loadAllPerfReference().then((els) => {
    // البنود الخاصة بأدوار (roles) لا تظهر إلا لمن يحمل أحدها في علاماته (tags)
    const pick = (list) => itemsForRoles(list, tags);
    if (track !== "activity") return pick(els.filter((e) => (e.track ?? "teacher") === track));
    // رائد النشاط: الجزء العام بطاقة واحدة للمقيِّم (بنودها عناصر المعلم بأوزانها للاطلاع)، ثم عناصر النشاط بشواهدها
    const general = els.filter((e) => (e.track ?? "teacher") === "teacher");
    return pick([
      { key: "a00", title: "عناصر الأداء العامة", weight: general.reduce((a, e) => a + (ACTIVITY_WEIGHTS[e.key] ?? 0), 0),
        sort_order: 0, evaluator_only: true, track: "activity",
        items: general.map((e, i) => ({ key: `a00_${String(i + 1).padStart(2, "0")}`, element_key: "a00", sort_order: i + 1,
          title: `${e.title} (${ACTIVITY_WEIGHTS[e.key] ?? e.weight}%)`, source: "school", is_record: false, portal: "judge" })) },
      ...els.filter((e) => e.track === "activity"),
    ]);
  });
}
function loadAllPerfReference() {
  if (!refCache) {
    refCache = Promise.all([
      supabase.from("perf_elements").select("*").order("sort_order"),
      supabase.from("perf_items").select("*").eq("is_active", true).order("sort_order"),
    ]).then(([{ data: els, error }, { data: its }]) => {
      if (error) { refCache = null; throw error; }
      const items = its ?? [];
      return (els ?? []).map((e) => ({ ...e, items: items.filter((i) => i.element_key === e.key) }));
    });
  }
  return refCache;
}

/** العام الدراسي النشط كما في الإعدادات */
export async function activeYear() {
  const { year } = await loadActiveTerm();
  return year;
}

export async function loadEvidence(uid, year) {
  const { data, error } = await supabase.from("perf_evidence").select("*")
    .eq("teacher_user_id", uid).eq("academic_year", year)
    .order("event_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** زيارات الدعم الصادرة للمعلم (من الوكلاء أو مدير المدرسة) — تظهر في ملفه تلقائيًا */
export async function loadSupportVisits(uid) {
  const { data } = await supabase.from("form_documents")
    .select("id, serial, title, status, created_at, signature_name, signature_role, form_templates!inner(key)")
    .eq("recipient_user_id", uid).eq("form_templates.key", "teacher_support_visit")
    .not("status", "in", "(draft,pending,rejected)")
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** بيانات المعلم الأساسية: الاسم والتخصص، والفصول والنصاب من جدول العام النشط */
export async function loadTeacherInfo(uid) {
  const { data: t } = await supabase.from("teachers")
    .select("id, full_name, specialization").eq("user_id", uid).maybeSingle();
  if (!t) return null;
  const { year, term } = await loadActiveTerm();
  const { data: sch } = await supabase.from("schedule")
    .select("class_id, classes(class_no, grade), subjects(name)")
    .eq("teacher_id", t.id).eq("academic_year", year).eq("term", term);
  const rows = sch ?? [];
  const classes = [...new Map(rows.filter((r) => r.classes).map((r) => [r.class_id, r.classes])).values()]
    .sort((a, b) => (a.grade ?? 0) - (b.grade ?? 0) || (a.class_no ?? 0) - (b.class_no ?? 0));
  const subjects = [...new Set(rows.map((r) => r.subjects?.name).filter(Boolean))];
  return { ...t, classes, subjects, periods: rows.length };
}

/* الشواهد الآلية: مصدرها في البوابة، ووحدة عدّها */
export const AUTO_SOURCE = {
  e11_01: { label: "اختبارات تشخيصية طُبّقت", to: "/quizzes" },
  e11_05: { label: "اختبارات فترات طُبّقت", to: "/quizzes" },
  e11_07: { label: "اختبارات بُنيت وطُبّقت", to: "/quizzes" },
  e07_06: { label: "اختبارات إلكترونية", to: "/quizzes" },
  e05_02: { label: "اختبارات صُحّحت وظهرت نتيجتها", to: "/quiz-marks" },
  e03_02: { label: "اختبارات وصلت نتيجتها للطالب وولي الأمر", to: "/quiz-marks" },
  e10_03: { label: "اختبارات اطّلع الطلاب على نتائجها", to: "/quiz-marks" },
  e11_04: { label: "اختبارات بتغذية راجعة فورية", to: "/quiz-marks" },
  e10_01: { label: "تحليلات اختبار معتمدة", to: "/quiz-analytics" },
  e10_02: { label: "تحليلات اختبار معتمدة", to: "/quiz-analytics" },
  e05_05: { label: "خطط علاجية حدّدت المهارات", to: "/quizzes" },
  e05_06: { label: "خطط علاجية", to: "/quizzes" },
  e05_07: { label: "خطط إثرائية", to: "/quizzes" },
  e06_04: { label: "خطط علاجية نُفّذت", to: "/quizzes" },
  e06_05: { label: "خطط إثرائية نُفّذت", to: "/quizzes" },
  e03_01: { label: "إشعارات لفصولك وأولياء أمورهم", to: "/notify" },
  e05_04: { label: "إشعارات لفصولك وأولياء أمورهم", to: "/notify" },
  e03_06: { label: "أيام رصد في سجل المتابعة", to: "/follow-up" },
  e11_02: { label: "أنواع تقويم مستخدمة في سجل المتابعة", to: "/follow-up" },
  e11_03: { label: "أنواع تقويم مستخدمة في سجل المتابعة", to: "/follow-up" },
  e05_10: { label: "شهادات أصدرتها لطلابك", to: "/forms" },
  // بنك الأسئلة: الأسئلة المشاركة مع معلمي المدرسة (supabase/qbank_3.sql)
  e02_08: { label: "أسئلة شاركتها في بنك المدرسة", to: "/qbank" },
  // بنك الأنشطة: يوم لكل نشاط نُفّذ أو نقاط دوري مُنحت (supabase/perf_auto_core_1.sql)
  e04_02: { label: "أيام نفّذت فيها نشاطًا صفيًا من بنك الأنشطة", to: "/activities?tab=class" },
  e08_04: { label: "أيام أنشطة متنوعة ونقاط دوري المادة", to: "/activities?tab=tools" },
  e09_05: { label: "أيام أنشطة تعاونية بالمجموعات", to: "/activities?tab=class" },
  // محضر معمل الحاسب الآلي (supabase/lab_perf_2.sql)
  l02_05: { label: "معلمون خدمهم المعمل", to: "/lab?tab=booking" },
  l04_01: { label: "حصص بدروس المعمل الرقمي", to: "/lab?tab=lessons" },
  l05_01: { label: "نتائج طلاب رُصدت برمز QR", to: "/lab?tab=lessons" },
  l05_02: { label: "أعمال في سجل التطبيقات العملية", to: "/lab?tab=record" },
  l06_01: { label: "حصص في جدول حجوزات المعمل", to: "/lab?tab=booking" },
  l07_01: { label: "أعطال حُلّت", to: "/lab?tab=tickets" },
  l07_02: { label: "أجهزة موثّقة المواصفات", to: "/lab?tab=devices" },
  l07_03: { label: "تثبيتات ملف المعمل الدائم", to: "/lab?tab=lessons" },
  l08_01: { label: "أجهزة جاهزة للعمل", to: "/lab?tab=devices" },
  l09_01: { label: "قواعد سلامة معتمدة", to: "/lab?tab=rules" },
  l09_02: { label: "طلاب أقرّوا بقواعد السلامة", to: "/lab?tab=rules" },
  l10_01: { label: "فصول لها خريطة جلوس", to: "/lab?tab=seating" },
  l11_01: { label: "حصص نُفّذت في المعمل", to: "/lab?tab=usage" },
  l11_02: { label: "استخدام سُجّل بلا حجز سابق", to: "/lab?tab=usage" },
  l12_01: { label: "أسابيع موثّقة في سجل الاستخدام", to: "/lab?tab=usage" },
  l13_01: { label: "أجهزة في سجل الأجهزة", to: "/lab?tab=devices" },
  l13_02: { label: "بلاغات أعطال مسجّلة", to: "/lab?tab=tickets" },
  // الموجه الطلابي والوكيل ورائد النشاط (supabase/staff_perf_4.sql)
  g03_01: { label: "جلسات مع أولياء الأمور", to: "/guidance" },
  g03_02: { label: "طلبات تواصل رُدّ عليها", to: "/guidance" },
  g04_01: { label: "إحالات اتُّخذ فيها إجراء", to: "/referrals" },
  g04_02: { label: "إحالات الغياب والطلاب المفقودين", to: "/referrals" },
  g05_01: { label: "برامج نمائية", to: "/guidance" },
  g06_01: { label: "برامج في خطة التوجيه", to: "/guidance" },
  g06_03: { label: "برامج نُفّذت", to: "/guidance" },
  g07_01: { label: "حالات فُتحت", to: "/guidance" },
  g07_04: { label: "حالات أُغلقت", to: "/guidance" },
  g08_01: { label: "برامج توعوية ووقائية", to: "/guidance" },
  g08_02: { label: "نشرات واستبانات أُرسلت", to: "/outreach" },
  g09_01: { label: "جلسات فردية", to: "/guidance" },
  g09_02: { label: "جلسات جمعية", to: "/guidance" },
  g12_01: { label: "برامج علاجية", to: "/guidance" },
  d03_01: { label: "إحالات أُشعر بها ولي الأمر", to: "/referrals" },
  d06_01: { label: "إحالات اتُّخذ فيها قرار", to: "/referrals" },
  d06_02: { label: "إنذارات غياب", to: "/student-affairs" },
  d06_03: { label: "نماذج سلوكية", to: "/behavior" },
  d09_01: { label: "زيارات دعم للمعلمين", to: "/forms" },
  d16_01: { label: "أحداث ومناسبات اعتمدتها", to: "/events" },
  d17_01: { label: "نشرات واستبانات أُرسلت", to: "/outreach" },
  d17_02: { label: "تصويت واستطلاعات", to: "/polls-admin" },
  // بنود خاصة بمجال كل وكيل (supabase/staff_perf_6.sql)
  d06_04: { label: "أعذار غياب بتّ فيها", to: "/absence-excuses" },
  d06_05: { label: "بلاغات انقطاع بتّ فيها", to: "/dropouts" },
  d18_03: { label: "بلاغات الفريق الكشفي أُغلقت", to: "/scout-reports" },
  d07_03: { label: "بلاغات صيانة عالجها", to: "/repairs" },
  d09_03: { label: "خطط تحسين يتابعها", to: "/improve" },
  d10_03: { label: "لقاءات وتقارير تطوير مهني اعتمدها", to: "/plc" },
  d11_03: { label: "آراء في ملفات المعلمين الرقمية", to: "/dfile-opinions" },
  d11_04: { label: "زيارات تبادلية اعتمدها", to: "/plc" },
  d12_03: { label: "متابعات رصد الدرجات", to: "/noor-grades" },
  d12_04: { label: "اجتماعات لجنة التحصيل", to: "/ach-committee" },
  d13_03: { label: "لقاءات الثقافة المدرسية", to: "/culture" },
  d15_03: { label: "نماذج رسمية أصدرها", to: "/my-documents" },
  // أعضاء فريق الثقافة المؤسسية (supabase/cult_7.sql)
  e02_12: { label: "أعمال في فريق الثقافة المؤسسية", to: "/culture" },
  // محضر مختبر العلوم من عمل مختبره (supabase/sci_lab_6.sql)
  s04_01: { label: "تجارب نُفّذت في المختبر", to: "/science-labs?tab=runs" },
  s10_01: { label: "حصص جهّزها للتجارب", to: "/science-labs?tab=booking" },
  s12_01: { label: "تجارب اعتمد تنفيذها", to: "/science-labs?tab=runs" },
  s12_02: { label: "أصناف في سجل العهدة", to: "/science-labs?tab=inventory" },
  s09_02: { label: "مواد كيميائية موثّقة الصلاحية", to: "/science-labs?tab=inventory" },
  s13_01: { label: "أجهزة في سجل العهدة", to: "/science-labs?tab=inventory" },
  s13_02: { label: "أصناف تالفة أو ناقصة رُصدت", to: "/science-labs?tab=inventory" },
  // مدير المدرسة (supabase/principal_perf_2.sql)
  m03_01: { label: "إشعارات ورسائل أرسلها", to: "/notifications" },
  m07_02: { label: "بلاغات صيانة عالجها", to: "/repairs" },
  m09_01: { label: "زيارات دعم للمعلمين", to: "/forms" },
  m09_02: { label: "خطط تحسين يتابعها", to: "/improve" },
  m10_01: { label: "لقاءات وتقارير وزيارات اعتمدها", to: "/plc" },
  m11_01: { label: "تقييمات أداء أرسلها للمعلمين", to: "/staff-performance" },
  m11_02: { label: "آراء في ملفات المعلمين الرقمية", to: "/dfile-opinions" },
  m12_02: { label: "اجتماعات لجنة التحصيل", to: "/ach-committee" },
  m13_01: { label: "تقارير التقويم الذاتي", to: "/accreditation" },
  m13_02: { label: "اجتماعات فريق التميز", to: "/accreditation" },
  m14_02: { label: "خطط تحسين اعتمدها", to: "/accreditation" },
  m15_01: { label: "تعاميم أرسلها", to: "/circulars" },
  m15_02: { label: "نماذج رسمية اعتمدها", to: "/forms-review" },
  m16_01: { label: "أحداث ومناسبات اعتمدها", to: "/events" },
  m17_01: { label: "نشرات واستبانات أُرسلت", to: "/outreach" },
  m17_02: { label: "تصويت واستطلاعات", to: "/polls-admin" },
  m17_03: { label: "أخبار نُشرت", to: "/news-admin" },
  m18_02: { label: "لقاءات الثقافة المدرسية", to: "/culture" },
  a12_02: { label: "أحداث ومناسبات معتمدة", to: "/events" },
  a13_01: { label: "تقارير تنفيذ الأحداث", to: "/events" },
  a14_01: { label: "إعلانات ترشيح منشورة", to: "/nominations" },
  a14_02: { label: "تصويت واستطلاعات", to: "/polls-admin" },
  a15_01: { label: "مشاركات طلاب في الأحداث", to: "/events" },
  a15_02: { label: "شهادات مشاركة صدرت", to: "/events" },
  l13_03: { label: "بلاغات رُفعت للصيانة الخارجية", to: "/lab?tab=tickets" },
};

/** الشواهد الآلية للمعلم (uid) أو لكل المعلمين (null): { [uid]: { [item]: { cnt, last } } }.
    ولمحضر المعمل (track = "lab") من عمل المعمل (supabase/lab_perf_2.sql) */
export async function loadAutoCounts(uid, year, track = "teacher") {
  // المعلم ورائد النشاط من عمل المعلم، ومحضر المعمل من عمل المعمل، والموجه والوكيل ورائد النشاط
  // من عملهم في البوابة (supabase/staff_perf_4.sql)؛ ومحضر مختبر العلوم بلا شواهد آلية بعد
  // وأعمال فريق الثقافة المؤسسية لأعضائه من المعلمين (supabase/cult_7.sql)
  const fns = track === "lab" ? ["lab_perf_auto"] : track === "teacher" ? ["perf_auto_counts", "cult_perf_auto"]
    : ["staff_perf_auto"];   // رائد النشاط والموظفون: من عملهم في البوابة وحده (لا تدريس ولا تطوير مهني)
  const m = {};
  for (const fn of fns) {
    const { data, error } = await supabase.rpc(fn, { p_uid: uid, p_year: year });
    if (error) continue;   // قبل تشغيل ملف SQL: لا شواهد آلية منه
    for (const r of data ?? []) (m[r.teacher_user_id] ??= {})[r.item_key] = { cnt: Number(r.cnt), last: r.last_at };
  }
  return m;
}

/** حالة كل بند: شواهده وعددها. العدد في البند العادي هو العداد،
    وفي بند السجل عدد المشاركات المرفقة. auto: الشاهد الآلي إن وُجد. */
export function itemStatus(item, evidence, autoMap = {}) {
  const list = evidence.filter((e) => e.item_key === item.key);
  const count = item.is_record ? list.length : (list[0]?.use_count ?? 0);
  const auto = autoMap[item.key]?.cnt > 0 ? autoMap[item.key] : null;
  return { list, count, auto, ok: list.length > 0 || !!auto };
}

/** ملخص عنصر: البنود ذات الشاهد المتوفر وغير المتوفر */
export function elementSummary(el, evidence, autoMap = {}) {
  const done = el.items.filter((i) => itemStatus(i, evidence, autoMap).ok).length;
  return { available: done, missing: el.items.length - done };
}

const isPdf = (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name ?? "");

/** يرفع ملف الشاهد (الصور تُصغَّر) ويعيد { path, name } */
export async function uploadEvidenceFile(uid, orig) {
  const pdf = isPdf(orig);
  if (!pdf && !(orig.type || "").startsWith("image/")) throw new Error(`«${orig.name}» ليس PDF ولا صورة.`);
  const file = pdf ? orig : await shrinkImage(orig, 2000, 0.85);
  if (file.size > MAX_BYTES) throw new Error(`«${orig.name}» أكبر من 5 م.ب.`);
  const ext = pdf ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(PERF_BUCKET)
    .upload(path, file, { contentType: pdf ? "application/pdf" : file.type, upsert: false });
  if (error) throw new Error(`تعذّر رفع «${orig.name}»: ${error.message}`);
  return { path, name: orig.name || `شاهد.${ext}` };
}

export async function removeEvidenceFile(path) {
  if (path) await supabase.storage.from(PERF_BUCKET).remove([path]);
}

/** يفتح مرفق الشاهد برابط مؤقت. التبويب يُفتح قبل الانتظار حتى لا يحجبه الجوال. */
export async function openEvidenceFile(path) {
  const win = window.open("", "_blank");
  const { data } = await supabase.storage.from(PERF_BUCKET).createSignedUrl(path, 300);
  if (!data?.signedUrl) {
    if (win) win.close();
    alert("تعذّر فتح المرفق.");
    return;
  }
  if (win) win.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}


/* «كيف أجمعه؟» — تلميح مختصر لكل بند: من أين يأتي شاهده في البوابة، أو ماذا يُرفع.
   مأخوذ من ربط الشواهد الآلي (perf_auto_counts) وأدلة البوابة المنشورة. */
const PD = "التطوير المهني ← نماذج سجل التطوير المهني";
const UP = "ارفع صورة أو PDF";
export const ITEM_HINT = {
  // 2. التفاعل مع المجتمع المهني
  e02_01: `${PD} ← «تنفيذ برنامج تدريبي»: وثّقه ويوقّع الحاضرون، ويصل بعد الاعتماد.`,
  e02_02: `${PD} ← «حضور برنامج تدريبي» مع الشهادة، ويُحتسب تلقائيًا إن وقّعت حاضرًا في برنامج زميل.`,
  e02_03: "التطوير المهني ← الزيارات التبادلية: استضف زميلًا من قسمك ووقّع بتعقيبك، وتصل بعد الاعتماد.",
  e02_04: "التطوير المهني ← الزيارات التبادلية: زر درس زميل وقيّمه، وتصل بعد توقيعه واعتمادها.",
  e02_05: `${PD} ← «حضور مؤتمر» وأرفق الشهادة.`,
  e02_06: "التطوير المهني: وقّع على محاضر جلسات مجتمع التعلم في قسمك، وتصل بعد اعتمادها.",
  e02_07: `${PD} ← «درس تطبيقي أو حلقة تنشيطية»، ويوقّع الحاضرون.`,
  e02_08: `تلقائي: كل سؤال تشاركه في «بنك الأسئلة» مع معلمي المدرسة، وفي تفاصيله كم استفاد منه زملاؤك. وأيضًا ${PD} ← «إنتاج معرفي أو تجربة أو وسيلة أو تطوع» وأرفق الشاهد.`,
  e02_09: "حمّل رخصتك المهنية من منصة سديد، ثم ارفعها هنا صورة أو PDF.",
  e02_10: `${UP} لما قدّمته للمعلمين الجدد: لقاء أو نماذج مشتركة أو حضور درس.`,
  e02_11: `${UP} لتأمل ذاتي مكتوب: ما الذي جرّبته وما الذي ستحسّنه.`,
  // 3. التفاعل مع أولياء الأمور
  e03_01: "تلقائي: كل إشعار ترسله من «الإشعارات» لفصولك يصل أولياء الأمور، وإشعار ولي الأمر في الإحالة يُحتسب كذلك.",
  e03_02: "تلقائي: صحّح الاختبار في «التصحيح والدرجات» فتصل النتيجة للطالب وولي أمره.",
  e03_03: `${UP} لكشف حضور اجتماع أولياء الأمور أو صورة منه.`,
  e03_04: "إحالة طالب: إشعار ولي الأمر خطوة في الإحالة السلوكية، أو ارفع استمارة الاستدعاء.",
  e03_05: "الأحداث والمناسبات: أشرك أولياء الأمور في فعالية (موافقاتهم تصل آليًا)، أو ارفع شاهدًا.",
  e03_06: "تلقائي: كل يوم ترصد فيه في «سجل المتابعة الإلكتروني» يُحتسب، ويطّلع عليه ولي الأمر.",
  e03_07: `${UP} لمحضر لقاء أو تواصل مع ولي أمر وما اتُّفق عليه.`,
  // 4. التنويع في استراتيجيات التدريس
  e04_01: `${UP} لنشاط أو ورقة عمل تنمّي التفكير والإبداع، وتفيد استمارة زيارة الدعم شاهدًا داعمًا.`,
  e04_02: `تلقائي: كل نشاط صفي تسجّل تنفيذه في «الأنشطة والألعاب». ولك أن ${UP.replace(/^ارفع/, "ترفع")} لتحضير درس يذكر الاستراتيجية.`,
  e04_03: `${UP} لنشاط قرائي أو حواري من درسك.`,
  e04_04: `${UP} لمثال من درس ربطته بالواقع: صورة أو ورقة عمل.`,
  // 5. تحسين نتائج المتعلمين
  e05_01: `${UP} لأهداف الدرس ومعايير النجاح كما عرضتها على الطلاب.`,
  e05_02: "تلقائي: صحّح الاختبارات في «التصحيح والدرجات» فتظهر النتيجة للطالب مباشرة.",
  e05_03: `${UP} لإفادة مخصصة لطالب أو مجموعة بحسب مستواهم.`,
  e05_04: "تلقائي: إشعاراتك من «الإشعارات» لفصولك وأولياء أمورهم.",
  e05_05: "تلقائي: «اختباراتي» ← دورة الاختبار ← خطة علاجية تحدّد فيها المهارات المفقودة.",
  e05_06: "تلقائي: «اختباراتي» ← دورة الاختبار ← خطة علاجية لمن لم يتقن.",
  e05_07: "تلقائي: «اختباراتي» ← دورة الاختبار ← خطة إثرائية للمتميزين.",
  e05_08: `${UP} لنموذج من ملف إنجاز طالب تابعته.`,
  e05_09: `${UP} لصفحات من كتب صحّحتها.`,
  e05_10: "تلقائي: «النماذج والشهادات» ← شهادة شكر وتقدير لطالب.",
  e05_11: `${UP} لخطتك أو نتائج طلابك في نافس والتحصيل.`,
  // 6. إعداد وتنفيذ خطة التعلم
  e06_01: `${UP} لتوزيع المنهج المسلَّم.`,
  e06_02: `${UP} لخطة التعلم الأسبوعية.`,
  e06_03: `${UP} لصورة من تحضير الدروس في منصة مدرستي.`,
  e06_04: "تلقائي: بعد تنفيذ الخطة العلاجية اضغط «تم التنفيذ» في دورة الاختبار.",
  e06_05: "تلقائي: بعد تنفيذ الخطة الإثرائية اضغط «تم التنفيذ» في دورة الاختبار.",
  e06_06: "الأحداث والمناسبات: نفّذ النشاط حتى تقريره المعتمد، أو ارفع خطة النشاط.",
  e06_07: "يقدّره المقيِّم بالملاحظة، ولك رفع ما يدعمه.",
  e06_08: `${UP} لنشاط أعددته مع معلم خبير.`,
  // 7. توظيف تقنيات ووسائل التعلم
  e07_01: `${UP} لسجل مصادر التعلم أو صفحة منه.`,
  e07_02: `${UP} لوسيلة أو تقنية استخدمتها مع طلابك.`,
  e07_03: "يقدّره المقيِّم بالملاحظة، ولك رفع نشاط علمي من درسك.",
  e07_04: `${UP} لنشاط استخدمت فيه تطبيق ذكاء اصطناعي.`,
  e07_05: `${UP} لصورة من تفعيل قنوات عين في حصتك.`,
  e07_06: "تلقائي: كل اختبار إلكتروني تطبّقه من «اختباراتي»، ولك رفع صور من منصة مدرستي.",
  // 8. تهيئة بيئة تعليمية
  e08_01: `${UP} لصور من فصلك أو قواعد السلامة فيه.`,
  e08_02: `${UP} لميثاق الفصل أو نشاط يعزز الاحترام.`,
  e08_03: `${UP} لنشاط عرض فيه الطلاب أفكارهم.`,
  e08_04: `تلقائي: أنشطة «الأنشطة والألعاب» ونقاط دوري المادة. ولك أن ${UP.replace(/^ارفع/, "ترفع")} لأنشطة متنوعة من دروسك.`,
  // 9. الإدارة الصفية
  e09_01: `${UP} لصورة القوانين الصفية معروضة في الفصل.`,
  e09_02: `${UP} لما يثبت متابعة تطبيق القوانين.`,
  e09_03: "إحالة طالب: توثيق التدرج في المخالفة (تنبيه ثم تدوين ثم إشعار) شاهد داعم، أو ارفع شاهدًا.",
  e09_04: "يُلاحظ في الزيارة الصفية، ولك رفع ما يدعمه.",
  e09_05: `تلقائي: الأنشطة التعاونية من بنك الأنشطة. ولك أن ${UP.replace(/^ارفع/, "ترفع")} لصورة تنظيم الفصل في مجموعات أو أركان.`,
  e09_06: "تفيد الخطط العلاجية والإثرائية في «اختباراتي»، أو ارفع نشاطًا متمايزًا.",
  // 10. تحليل نتائج المتعلمين
  e10_01: "تلقائي: «اختباراتي» ← دورة الاختبار ← «اعتماد التحليل»، وتجده في «تحليل النتائج».",
  e10_02: "تلقائي: كل تحليل اختبار تعتمده في دورة الاختبار يبيّن نقاط القوة والضعف.",
  e10_03: "تلقائي: يطّلع الطالب على نتيجته بعد التصحيح في «التصحيح والدرجات».",
  e10_04: `${UP} لأهداف قصيرة وطويلة المدى وضعتها لطلابك.`,
  e10_05: `${UP} لمشروع أو مهمة أدائية من واقع الطلاب.`,
  // 11. تنوع أساليب التقويم
  e11_01: "تلقائي: «اختباراتي» ← اختبار نوعه «تشخيصي».",
  e11_02: "تلقائي: نوّع ما ترصده في «سجل المتابعة الإلكتروني»: واجبات ومشاركة ومهام وعملي.",
  e11_03: "تلقائي: كما في البند السابق، كل نوع ترصده في سجل المتابعة يُحتسب.",
  e11_04: "تلقائي: صحّح في «التصحيح والدرجات» فتصل الدرجة والتغذية الراجعة للطالب.",
  e11_05: "تلقائي: «اختباراتي» ← اختبارات الفترة الأولى والثانية.",
  e11_06: `${UP} لاختبار ختامي أو كشف نتائجه.`,
  e11_07: "تلقائي: كل اختبار تبنيه وتطبّقه من «اختباراتي».",
  // محضر معمل الحاسب الآلي — نموذج «محضر المختبر»
  l02_01: "أضف كل برنامج أو ورشة حضرتها بشهادتها، وتُجمع المشاركات وساعاتها.",
  // التفاعل مع المجتمع المهني لغير المعلمين: ليس لهم «التطوير المهني» في البوابة، فكل الشواهد ترفع هنا يدويًا
  g02_01: "«إضافة مشاركة»: كل برنامج تدريبي حضرته في التوجيه والإرشاد بشهادته وجهته وساعاته، وتُجمع المشاركات وساعاتها.",
  g02_02: `${UP} لإعلان اللقاء أو الورشة التي قدّمتها للمعلمين، أو صور منها، أو كشف حضورهم.`,
  g02_03: `${UP} لمحضر لقاء مع موجهين أو زملاء، أو مشاركة في مجتمع تعلم مهني.`,
  d02_01: "«إضافة مشاركة»: كل برنامج تدريبي حضرته في القيادة المدرسية بشهادته وجهته وساعاته، وتُجمع المشاركات وساعاتها.",
  d02_02: `${UP} لمحضر لقاء تبادل خبرات مع وكلاء أو قادة مدارس، أو مشاركة في مجتمع تعلم مهني.`,
  m02_01: "«إضافة مشاركة»: كل برنامج تدريبي حضرته في القيادة المدرسية بشهادته وجهته وساعاته، وتُجمع المشاركات وساعاتها.",
  m02_02: `${UP} لمحضر لقاء تبادل خبرات مع قادة المدارس، أو مشاركة في مجتمع تعلم مهني.`,
  s02_01: "«إضافة مشاركة»: كل برنامج تدريبي حضرته في المختبرات أو السلامة بشهادته وجهته وساعاته، وتُجمع المشاركات وساعاتها.",
  s02_02: `${UP} لمحضر لقاء مع معلمي العلوم أو محضرين آخرين، أو مشاركة في مجتمع تعلم مهني.`,
  l02_02: `${UP} لإعلان الورشة أو صور منها أو كشف حضور المعلمين.`,
  l02_03: `${UP} لدليل استخدام المعمل الذي أعددته (للمعلم أو الطالب أو الدعم الفني).`,
  l02_04: `${UP} لمحضر جلسة مجتمع تعلم حضرتها.`,
  l02_05: "تلقائي: معلمو الحاسب الذين حجزوا المعمل من «حجز المعمل».",
  l03_01: `${UP} لرسالة التوعية بقواعد السلامة المرسلة لأولياء الأمور.`,
  l03_02: `${UP} لإنجاز طلابي من المعمل شاركته مع الأسر.`,
  l03_03: `${UP} لتواصل مع ولي أمر بشأن استخدام ابنه للأجهزة.`,
  l04_01: "تلقائي: كل حصة تنشئها من «الدروس» في معمل الحاسب.",
  l04_02: `دروس المعمل الرقمي مبنية بالمحطات. ${UP} لصور من حصة بالمحطات.`,
  l04_03: `${UP} لصورة الدرس معروضًا على السبورة.`,
  l04_04: `يعمل الملف الدائم دون إنترنت. ${UP} لصورة حصة على أجهزة المعمل دون اتصال.`,
  l05_01: "تلقائي: كل نتيجة طالب تُرصد بمسح رمز QR في نهاية الدرس.",
  l05_02: "تلقائي: كل عمل يُنقل إلى «سجل التطبيقات».",
  l05_03: `${UP} لخطة أو نشاط دعم لطلاب متعثرين في مهارة عملية.`,
  l06_01: "تلقائي: حصص المعمل في «حجز المعمل».",
  l06_02: `${UP} لخطة المعمل اليومية أو الأسبوعية معتمدة من المدير.`,
  l06_03: `الحجز يتخطّى الإجازات الرسمية تلقائيًا. ${UP} لجدول المعمل مع جدول المعلمين.`,
  l07_01: "تلقائي: كل بلاغ تحلّه في «البلاغات».",
  l07_02: "تلقائي: الأجهزة التي كتبت مواصفاتها في «سجل الأجهزة».",
  l07_03: "تلقائي: كل تثبيت لملف المعمل الدائم من «الدروس».",
  l07_04: `${UP} لشهادة دورة فنية أو في الإسعافات الأولية والسلامة.`,
  l08_01: "تلقائي: الأجهزة التي حالتها «يعمل» في «سجل الأجهزة».",
  l08_02: `${UP} لكشف حصر احتياج المعمل.`,
  l08_03: `${UP} لخطاب طلب أو محضر استلام أجهزة أو ملحقات.`,
  l09_01: "تلقائي: قواعد السلامة في «قواعد السلامة»، ولوحتها تُطبع منها.",
  l09_02: "تلقائي: إقرار الطلاب بقواعد السلامة كل فصل دراسي.",
  l09_03: `${UP} لكشف مراجعة دورية للأجهزة والتوصيلات.`,
  l10_01: "تلقائي: الفصول التي لها خريطة في «خريطة الجلوس».",
  l10_02: `${UP} لصور ملصقات الأجهزة أو خلفياتها المطبوعة من البوابة.`,
  l10_03: `${UP} لصور المعمل مرتّبًا قبل الحصة.`,
  l11_01: "تلقائي: الحصص المنفّذة في «سجل الاستخدام».",
  l11_02: "تلقائي: ما يُسجَّل في «سجل الاستخدام» بلا حجز سابق.",
  l11_03: `${UP} لصورة تخزين الملحقات أو كشف الاستلام.`,
  l12_01: "تلقائي: الأسابيع التي عمل فيها المعمل في «سجل الاستخدام»، وتقريرها يُطبع منه.",
  l12_02: `${UP} لتقرير أسبوعي بالمهام والتحديات موقّع.`,
  l12_03: `سجل الأجهزة والاستخدام في البوابة. ${UP} لسجل الموجودات أو المستهلكات.`,
  l13_01: "تلقائي: «سجل الأجهزة» بحالة كل جهاز، وتقريره يُطبع منه.",
  l13_02: "تلقائي: كل بلاغ عطل في «البلاغات».",
  l13_03: "تلقائي: البلاغات المحوّلة إلى «صيانة خارجية».",
  l13_04: `${UP} لتقرير حالة الأجهزة المطبوع من «سجل الأجهزة» موقّعًا من المدير.`,
};
