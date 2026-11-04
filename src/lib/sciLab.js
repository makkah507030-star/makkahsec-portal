// src/lib/sciLab.js
// مختبرات العلوم (supabase/sci_lab_*.sql): الأحياء والكيمياء والفيزياء، وتجارب الخطط الفصلية،
// والحجز، وسجل التنفيذ، والعهدة. يدير كل مختبر محضره، ومعه مدير المدرسة والدعم الفني ووكيل الشؤون المدرسية.
import { supabase } from "./supabase";

export const SCI_LABS = [
  { key: "bio", name: "مختبر الأحياء", subject: "الأحياء", role: "science_labs", color: "#3F7D58" },
  { key: "chem", name: "مختبر الكيمياء", subject: "الكيمياء", role: "science_labs_3", color: "#3F6B99" },
  { key: "phys", name: "مختبر الفيزياء", subject: "الفيزياء", role: "science_labs_2", color: "#8A5A2B" },
];
export const labOf = (key) => SCI_LABS.find((l) => l.key === key) ?? SCI_LABS[0];
export const SCI_MANAGER_ROLES = ["principal", "tech_support", "deputy_school"];
export const SCI_PREP_ROLES = SCI_LABS.map((l) => l.role);

/** المختبرات التي يديرها صاحب الأدوار */
export const managedLabs = (adminRoles = []) => (SCI_MANAGER_ROLES.some((r) => adminRoles.includes(r))
  ? SCI_LABS.map((l) => l.key) : SCI_LABS.filter((l) => adminRoles.includes(l.role)).map((l) => l.key));

export const KIND = { launch: "تجربة استهلالية", main: "تجربة", lab: "مختبر المادة" };
export const OUTCOME = { lab: "نُفّذت في المختبر", virtual: "مختبرات افتراضية", not_done: "لم تُنفّذ" };
export const REASON = {
  materials: "عدم توفر المواد والأدوات",
  prep: "عدم تجهيز المحضر للتجربة",
  teacher: "عدم قيام المعلم بالتجربة",
  other: "أسباب أخرى",
};
export const PREP = { pending: "بانتظار التجهيز", ready: "جاهز", issue: "ينقصه شيء" };
export const INV_KIND = { device: "جهاز", tool: "أداة", chemical: "مادة كيميائية", other: "أخرى" };
export const INV_STATUS = { ok: "صالح", damaged: "تالف", missing: "ناقص" };

export const setupMsg = (e) => (/sci_|schema cache|relation/i.test(e?.message ?? "")
  ? "مختبرات العلوم تحتاج تشغيل ملفات supabase/sci_lab_1.sql إلى sci_lab_6.sql في Supabase ← SQL Editor." : e?.message);

/** مختبرات المعلم بتخصصه أو جدوله */
export async function myTeacherLabs() {
  const { data, error } = await supabase.rpc("sci_teacher_labs");
  return error ? [] : data ?? [];
}

/** تجارب المختبر مرتبة بالمقرر ثم الرقم */
export async function loadExperiments(lab) {
  const { data, error } = await supabase.from("sci_experiments").select("*").eq("lab", lab)
    .order("grade").order("course").order("no");
  if (error) throw error;
  return data ?? [];
}

/** المقررات في قائمة التجارب بترتيبها */
export const coursesOf = (exps) => [...new Set(exps.map((e) => e.course))];

/** «الحالة» لكل تجربة في فصل: آخر سجل تنفيذ لها */
export const runKey = (expId, classId) => `${expId}|${classId}`;
