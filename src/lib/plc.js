import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useSession } from "./session.jsx";
import { sendPush } from "./pushSend.js";

/* =====================================================================
   التطوير المهني — تقرير جلسة مجتمع التعلم المهني (supabase/plc_*.sql).
   يصدره رئيس القسم، ويوقّعه الحاضرون من معلمي قسمه، ويعتمده وكيل
   الشؤون التعليمية، ويطّلع عليه المدير ويكتب ملاحظته. والمعتمد يُضاف
   مشاركةً في سجل التطوير المهني (2-6) لرئيس القسم ولكل من وقّع.
   الأسماء من سجل المعلمين في البوابة لا من قوائم الورق.
   ===================================================================== */

export const PLC_BUCKET = "plc-photos";
export const MAX_PHOTOS = 3;

export const PLC_STAGES = [
  { key: "info",      t: "بيانات الجلسة" },
  { key: "content",   t: "محتوى الجلسة" },
  { key: "attendees", t: "الحاضرون" },
  { key: "photos",    t: "الشواهد" },
  { key: "signing",   t: "توقيع الحاضرين" },
  { key: "approval",  t: "الاعتماد" },
];

export const PLC_STATUS = {
  draft:    { t: "مسودة",               c: "bg-canvas text-muted" },
  signing:  { t: "بانتظار توقيع الحاضرين", c: "bg-warning-light text-warning" },
  pending:  { t: "بانتظار الاعتماد",     c: "bg-warning-light text-warning" },
  approved: { t: "معتمدة",               c: "bg-present/10 text-present" },
  returned: { t: "مُعادة بملاحظة",        c: "bg-absent/10 text-absent" },
};

/* حقول البيانات الأساسية */
export const PLC_INFO = [
  { key: "no",     t: "رقم الجلسة",                 presets: ["الجلسة الأولى", "الجلسة الثانية", "الجلسة الثالثة", "الجلسة الرابعة", "الجلسة الخامسة"] },
  { key: "topic",  t: "موضوع الجلسة",               required: true },
  { key: "tool",   t: "أوعية وأدوات التطوير المهني", presets: ["التدريب المصغر", "الدرس التطبيقي", "الزيارات التبادلية", "القراءة الموجهة", "البحث الإجرائي", "دراسة الحالة", "تحليل النتائج", "الورشة التدريبية"] },
  { key: "date",   t: "التاريخ",                    type: "date", required: true },
  { key: "place",  t: "مكان التنفيذ",               presets: ["صالة الاجتماعات بالمدرسة", "غرفة القسم", "مركز مصادر التعلم", "قاعة التدريب"] },
  { key: "target", t: "الفئة المستهدفة",            presets: ["معلمو القسم", "معلمو التخصص"] },
  { key: "next",   t: "موعد الجلسة القادمة",        presets: ["يحدد لاحقًا", "بعد أسبوعين", "بعد أربعة أسابيع"] },
];

/* محتوى الجلسة: الحقول تبدأ فارغة، والبطاقات تضيف سطرًا */
export const PLC_CONTENT = [
  { key: "intro", t: "مقدمة", presets: [
    "عُقدت جلسة مجتمع التعلم المهني بحضور معلمي القسم لتبادل الخبرات وتطوير الممارسات الصفية، وفق الخطة المعتمدة للفصل الدراسي.",
    "عُقدت الجلسة ضمن خطة القسم للتطوير المهني، لمناقشة نتائج الطلاب والاتفاق على إجراءات تحسينها.",
  ] },
  { key: "goals", t: "أهداف الجلسة", presets: [
    "توحيد معايير بناء الاختبارات بين معلمي القسم.", "تبادل الخبرات في توظيف استراتيجيات التعلم النشط.",
    "تحديد مواطن الضعف لدى الطلاب ومعالجتها.", "الاتفاق على خطة علاجية موحدة للوحدة القادمة.",
    "تحليل نتائج الاختبارات واستخلاص مؤشرات الأداء.", "مواءمة الخطة الفصلية وتوزيع المنهج.",
    "تطوير أدوات التقويم وتنويعها.", "تبادل التجارب في إدارة الصف وتحفيز الطلاب.",
  ] },
  { key: "talks", t: "المناقشات", presets: [
    "عرض تجارب المعلمين في الحصص السابقة.", "صعوبات تطبيق الاستراتيجيات داخل الصف.",
    "مراجعة أدوات التقويم ومدى ملاءمتها للمرحلة.", "مقترحات توظيف التقنية في عرض الدرس.",
    "قراءة نتائج الطلاب في الاختبار الأخير.", "توظيف منصة مدرستي في الواجبات والاختبارات.",
    "أسباب تدني مستوى بعض الطلاب وطرق دعمهم.",
  ] },
  { key: "results", t: "نتائج الجلسة", presets: [
    "تبنّي استراتيجيتين مشتركتين في القسم.", "إعداد بنك أسئلة موحد للوحدة القادمة.",
    "الاتفاق على معايير تصحيح موحدة.", "خطة لرفع مشاركة الطلاب الأقل تحصيلًا.",
    "توزيع المهام بين معلمي القسم.", "اعتماد نموذج موحد للتحضير.",
  ] },
  { key: "recs", t: "التوصيات", presets: [
    "تطبيق ما اتُّفق عليه في الحصص القادمة.", "توثيق الشواهد ورفعها في ملف القسم.",
    "عقد جلسة متابعة بعد أربعة أسابيع.", "تعميم الخلاصة على معلمي القسم كافة.",
    "تبادل الزيارات الصفية بين معلمي القسم.", "تنفيذ درس تطبيقي للاستراتيجية المتفق عليها.",
  ] },
];

/* ما ينقص كل مرحلة قبل الانتقال منها (فارغ = مكتملة) */
export function stageMissing(key, s) {
  const d = s?.data ?? {};
  if (key === "info") return PLC_INFO.filter((f) => f.required && !String(d[f.key] ?? "").trim()).map((f) => f.t);
  if (key === "content") return PLC_CONTENT.filter((f) => !String(d[f.key] ?? "").trim()).map((f) => f.t);
  if (key === "attendees") return (s?.attendees ?? []).length ? [] : ["الحاضرون"];
  return [];
}

/* أسطر النص المرقّمة للطباعة */
export const lines = (t) => String(t ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

let deptCache = null;
/** قسم المستخدم ودوره فيه: { department_id, department_name, is_head } أو null */
export function useMyDepartment() {
  const { session } = useSession();
  const uid = session?.user?.id;
  const [dept, setDept] = useState(deptCache?.uid === uid ? deptCache.v : undefined);
  useEffect(() => {
    if (!uid || deptCache?.uid === uid) return;
    supabase.rpc("my_department").then(({ data, error }) => {
      const v = error ? null : data?.[0] ?? null;
      deptCache = { uid, v };
      setDept(v);
    });
  }, [uid]);
  return dept;
}

export const headLabel = (d) => (d?.is_head ? `رئيس قسم ${d.department_name}` : "");

/** معلمو القسم بأسمائهم الكاملة من البوابة */
export async function loadDeptTeachers(deptId) {
  const { data } = await supabase.from("department_members")
    .select("is_head, teachers(id, user_id, full_name)").eq("department_id", deptId);
  return (data ?? []).filter((m) => m.teachers)
    .map((m) => ({ teacher_id: m.teachers.id, user_id: m.teachers.user_id, name: m.teachers.full_name, is_head: m.is_head }))
    .sort((a, b) => (b.is_head - a.is_head) || a.name.localeCompare(b.name, "ar"));
}

export async function photoUrl(path) {
  const { data } = await supabase.storage.from(PLC_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** إشعار داخل البوابة (آلي: لا يُحتسب في شواهد التواصل) */
export async function plcNotify(userIds, title, body, link) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  try {
    const { data: nid } = await supabase.rpc("send_notification", {
      p_title: title, p_body: body, p_kind: "general", p_link: link,
      p_roles: null, p_user_ids: ids, p_grade: null, p_class_no: null, p_is_auto: true,
    });
    if (nid) await sendPush(nid);
  } catch { /* الإجراء نفسه حُفظ */ }
}
