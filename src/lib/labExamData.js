// src/lib/labExamData.js
// قراءة وحفظ مركز اختبارات التقنية الرقمية (supabase/lab_exam_1.sql)، ورصد الدرجة في «سجل التطبيقات»:
// لكل اختبار عمل في سجل كل فصل (lab_works) بدرجته العظمى، تُكتب فيه درجة الطالب عند كل حفظ.
import { supabase } from "./supabase";
import { DEFAULT_LAB } from "./lab.js";

export const setupMsg = (e) => (/lab_exam|lab_qbank|schema cache|does not exist/.test(e?.message ?? "")
  ? "مركز الاختبارات يحتاج تشغيل supabase/lab_exam_1.sql في Supabase ← SQL Editor." : e?.message ?? "تعذّر التحميل.");

/** فصول الصف في المعمل: [{ class_id, class_no, grade, students }] */
export async function gradeClasses(grade, lab = DEFAULT_LAB) {
  const { data } = await supabase.rpc("lab_classes", { p_lab: lab });
  return (data ?? []).filter((c) => c.grade === grade);
}

/** طلاب الفصل مرتبين بالاسم: [{ id, full_name }] */
export async function classStudents(classId, lab = DEFAULT_LAB) {
  const { data } = await supabase.rpc("lab_record", { p_lab: lab, p_class: classId });
  return (data?.students ?? []).map((s) => ({ id: s.id, full_name: s.name }));
}

/** عمل الاختبار في سجل الفصل: يُنشأ أول مرة ويُحفظ معرّفه في الاختبار */
async function ensureWork(exam, classId) {
  if (exam.works?.[classId]) return exam.works[classId];
  const { data: id, error } = await supabase.rpc("lab_work_add", { p_lab: exam.lab_id, p_class: classId, p_title: exam.title, p_max: exam.total });
  if (error) throw error;
  exam.works = { ...(exam.works ?? {}), [classId]: id };
  await supabase.from("lab_exams").update({ works: exam.works }).eq("id", exam.id);
  return id;
}

/**
 * حفظ نتيجة طالب ورصدها في سجل التطبيقات. sub: { answers, score, detail, absent }.
 * يُرجع الصف المحفوظ { score, absent… } لعرضه، ويرمي الخطأ لعرضه للمعلم.
 */
export async function saveSub(exam, classId, studentId, sub) {
  const row = { exam_id: exam.id, student_id: studentId, answers: sub.answers ?? null, score: sub.absent ? null : sub.score,
    detail: sub.detail ?? null, absent: !!sub.absent, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("lab_exam_subs").upsert(row);
  if (error) throw error;
  const work = await ensureWork(exam, classId);
  const { error: e2 } = await supabase.rpc("lab_mark_set", { p_work: work, p_student: studentId, p_mark: row.score });
  if (e2) throw e2;
  return row;
}

/** نتائج الاختبار: { student_id: row } */
export async function loadSubs(examId) {
  const { data } = await supabase.from("lab_exam_subs").select("*").eq("exam_id", examId);
  return Object.fromEntries((data ?? []).map((r) => [r.student_id, r]));
}
