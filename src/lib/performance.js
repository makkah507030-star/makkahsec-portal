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
export const SOURCE_LABEL = { upload: "مرفوع", form: "نموذج", visit: "زيارة دعم", plc: "مجتمع تعلم" };

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
