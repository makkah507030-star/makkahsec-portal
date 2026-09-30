// src/pages/studio/data.js
import { supabase } from "../../lib/supabase";
import { loadPeriodTimes } from "../../lib/periodTimes";

/* =====================================================================
   بيانات قوالب المرحلة الثالثة — تُحمَّل عند فتح القالب فقط.
   ===================================================================== */

// "07:50:00" ← "7:50"
const hm = (t) => { if (!t) return ""; const [h, m] = String(t).split(":"); return `${Number(h)}:${m}`; };

// الاسم الأول والأخير — ليتسع في خلية الجدول
export const shortName = (n) => {
  const w = String(n ?? "").trim().split(/\s+/).filter((x) => !["بن", "بنت", "أ.", "ال"].includes(x));
  return w.length > 1 ? `${w[0]} ${w[w.length - 1]}` : (w[0] ?? "");
};

/* جدول الحصص للعام والفصل الحاليين، مع أعمدة الحصص والفسح من التوقيت المعتمد */
export async function loadSchedule(c) {
  const [{ data: rows }, times] = await Promise.all([
    supabase.from("schedule")
      .select("day_of_week, period_no, teacher_id, classes(class_no, grade), subjects(name), teachers(full_name)")
      .eq("academic_year", c.activeYear ?? "").eq("term", c.activeTerm ?? 1),
    loadPeriodTimes().catch(() => ({ rows: [] })),
  ]);
  const sched = (rows ?? []).map((r) => ({
    day: r.day_of_week, period: r.period_no, teacherId: r.teacher_id,
    classNo: r.classes?.class_no, grade: r.classes?.grade,
    subject: r.subjects?.name ?? "", teacher: r.teachers?.full_name ?? "",
  }));
  const maxP = Math.max(6, ...sched.map((r) => r.period));
  // أعمدة الجدول: الحصص بأوقاتها، والفسحة أو الصلاة بينها إن وُجدت في التوقيت
  let cols = (times?.rows ?? []).map((t) => t.kind === "period"
    ? { kind: "period", n: t.period_no, time: `${hm(t.start_time)} – ${hm(t.end_time)}` }
    : { kind: "break", label: t.label });
  if (!cols.some((x) => x.kind === "period")) cols = Array.from({ length: maxP }, (_, i) => ({ kind: "period", n: i + 1, time: "" }));
  cols = cols.filter((x) => x.kind === "break" || x.n <= maxP);
  // لا فسحة في الطرفين
  while (cols[0]?.kind === "break") cols.shift();
  while (cols.at(-1)?.kind === "break") cols.pop();

  const teachers = [...new Map(sched.filter((r) => r.teacherId).map((r) => [r.teacherId, r.teacher])).entries()]
    .map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  return { sched, cols, teachers };
}

/* طلاب العام الحالي بفصولهم — لملصقات أرقام الجلوس (للإدارة) */
export async function loadStudents() {
  const { data } = await supabase.from("v_active_students")
    .select("student_id, full_name, class_no, grade").order("class_no").order("full_name");
  return { students: data ?? [] };
}

/* المعلمون النشطون — لطباعة بطاقات التعريف دفعة واحدة */
export async function loadStaff() {
  const { data } = await supabase.from("teachers")
    .select("full_name, specialization").eq("is_active", true).order("full_name");
  return { staff: data ?? [] };
}
