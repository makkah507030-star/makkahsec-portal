import { supabase } from "./supabase.js";
import { shrinkImage } from "./imageResize.js";
import { loadActiveTerm } from "./officialAttendance.js";

/* =====================================================================
   ملف الأداء الوظيفي للمعلم — البيانات المشتركة بين صفحة المعلم وصفحة المدير
   وزر «إرسال إلى ملف الشواهد» في النماذج (supabase/teacher_performance.sql).
   • البند العادي: شاهد واحد وعداد (use_count).
   • بنود سجل التطوير المهني (is_record): كل مشاركة شاهد مستقل، والعدد = عددها.
   • «أداء الواجبات الوظيفية» للمقيِّم فقط: لا شواهد له.
   ===================================================================== */

export const PERF_BUCKET = "perf-evidence";
export const MAX_BYTES = 5 * 1024 * 1024;
export const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";
export const SOURCE_LABEL = { upload: "مرفوع", form: "نموذج", visit: "زيارة دعم", plc: "مجتمع تعلم", xvisit: "زيارة تبادلية", pd: "نموذج تطوير" };

/* لون مميّز لكل عنصر — درجات هادئة تنسجم مع أخضر الهوية، بإضاءة متقاربة
   فيبقى النص الأبيض والعناوين مقروءة. عنصر المقيِّم رمادي محايد. */
export const ELEMENT_COLOR = {
  e01: "#6b6b6b", e02: "#3e6350", e03: "#2f7f7a", e04: "#3f6b99", e05: "#5a5f9e", e06: "#7a5c99",
  e07: "#9a4f6e", e08: "#a5523f", e09: "#b07a2a", e10: "#7d7f2a", e11: "#5f8a3a",
};
export const elementColor = (key) => ELEMENT_COLOR[key] ?? "#3e6350";

/* حالة البند في البوابة (perf_items.portal — supabase/teacher_performance_portal.sql) */
export const PORTAL_TAG = {
  auto:    { t: "يصل تلقائيًا من عملك في البوابة", c: "bg-mint-light text-mint-deep" },
  partial: { t: "متوفر جزئيًا في البوابة · أكمله برفع شاهد", c: "bg-canvas text-muted" },
  manual:  { t: "يُرفع يدويًا الآن · سيكون متاحًا في البوابة قريبًا", c: "bg-warning-light text-warning" },
  record:  { t: "سجل التطوير المهني: كل مشاركة بشاهدها", c: "bg-mint-tint text-mint-deep" },
  judge:   { t: "يقدّره المقيِّم بالملاحظة، ويمكنك رفع شاهد", c: "bg-canvas text-muted" },
};

let refCache = null;
/** العناصر وبنودها مرتبة، مع بنود كل عنصر في elements[i].items */
export function loadPerfReference() {
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
};

/** الشواهد الآلية للمعلم (uid) أو لكل المعلمين (null): { [uid]: { [item]: { cnt, last } } } */
export async function loadAutoCounts(uid, year) {
  const { data, error } = await supabase.rpc("perf_auto_counts", { p_uid: uid, p_year: year });
  if (error) return {};   // قبل تشغيل ملف المرحلة الثانية: لا شواهد آلية
  const m = {};
  for (const r of data ?? []) (m[r.teacher_user_id] ??= {})[r.item_key] = { cnt: Number(r.cnt), last: r.last_at };
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

/** يرسل مستندًا صادرًا إلى ملف الشواهد؛ يعيد قيمة العداد بعد الإرسال */
export async function sendFormToFile(docId, itemKey) {
  const year = await activeYear();
  const { data, error } = await supabase.rpc("perf_send_form", { p_doc: docId, p_item: itemKey, p_year: year });
  if (error) throw error;
  return data;
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
  e02_08: `${PD} ← «إنتاج معرفي أو تجربة أو وسيلة أو تطوع» وأرفق الشاهد.`,
  e02_09: `${UP} للرخصة المهنية.`,
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
  e04_02: `${UP} لتحضير درس يذكر الاستراتيجية، أو صور من تطبيقها.`,
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
  e08_04: `${UP} لأنشطة متنوعة من دروسك.`,
  // 9. الإدارة الصفية
  e09_01: `${UP} لصورة القوانين الصفية معروضة في الفصل.`,
  e09_02: `${UP} لما يثبت متابعة تطبيق القوانين.`,
  e09_03: "إحالة طالب: توثيق التدرج في المخالفة (تنبيه ثم تدوين ثم إشعار) شاهد داعم، أو ارفع شاهدًا.",
  e09_04: "يُلاحظ في الزيارة الصفية، ولك رفع ما يدعمه.",
  e09_05: `${UP} لصورة تنظيم الفصل في مجموعات أو أركان.`,
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
};
