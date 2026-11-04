// src/lib/regulars.js
// =====================================================================
//  المنتظمون: طلاب بلا أي غياب رسمي (بعذر أو بدونه) في أيام الفصل الحالي المعتمدة،
//  ومعهم عدد مرات التأخر الصباحي، للتكريم. المصدر نفسه الذي تعتمد عليه الإنذارات:
//  official_attendance_days (الأيام المعتمدة) وofficial_day_marks (حالة الطالب فيها).
//  اليوم الذي لم يعتمده الوكيل لا يدخل، ومن انتقل للمدرسة متأخرًا لا تظهر أيامه السابقة.
// =====================================================================
import { supabase } from "./supabase";
import { fetchAllPaged } from "./attendanceHelpers";
import { loadActiveTerm } from "./officialAttendance";

export async function loadRegulars() {
  const { year, term } = await loadActiveTerm();
  const { data: days, error } = await supabase.from("official_attendance_days")
    .select("attend_date").eq("academic_year", year).eq("term", term).order("attend_date");
  if (error) throw error;
  const dates = (days ?? []).map((d) => d.attend_date);
  const [marks, { data: roster, error: e2 }] = await Promise.all([
    dates.length
      ? fetchAllPaged(() => supabase.from("official_day_marks")
          .select("attend_date, student_id, status, late_minutes")
          .gte("attend_date", dates[0]).lte("attend_date", dates[dates.length - 1])
          .order("attend_date").order("student_id"))
      : Promise.resolve([]),
    supabase.from("v_active_students").select("student_id, full_name, national_id, grade, class_no"),
  ]);
  if (e2) throw e2;
  const inDays = new Set(dates);
  const gone = new Set(), late = new Map();
  marks.forEach((m) => {
    if (!inDays.has(m.attend_date)) return;
    if (m.status === "absent" || m.status === "excused") gone.add(m.student_id);
    if (m.late_minutes > 0) late.set(m.student_id, (late.get(m.student_id) ?? 0) + 1);
  });
  const rows = (roster ?? []).filter((s) => !gone.has(s.student_id) && s.grade)
    .map((s) => ({ ...s, late: late.get(s.student_id) ?? 0 }))
    .sort((a, b) => a.grade - b.grade || a.class_no - b.class_no || a.late - b.late
      || String(a.full_name).localeCompare(String(b.full_name), "ar"));
  // أعداد طلاب كل فصل (للنسب)، ومن غاب يومًا واحدًا فقط أو يومين (قريبون من الانتظام)
  const sizes = {}, absDays = new Map();
  (roster ?? []).forEach((s) => { if (s.grade) sizes[`${s.grade}-${s.class_no}`] = (sizes[`${s.grade}-${s.class_no}`] ?? 0) + 1; });
  marks.forEach((m) => { if (inDays.has(m.attend_date) && (m.status === "absent" || m.status === "excused"))
    absDays.set(m.student_id, (absDays.get(m.student_id) ?? 0) + 1); });
  const near = (roster ?? []).filter((s) => s.grade && absDays.get(s.student_id) <= 2)
    .map((s) => ({ grade: s.grade, class_no: s.class_no, abs: absDays.get(s.student_id) }));
  return { year, term, days: dates.length, from: dates[0] ?? null, to: dates[dates.length - 1] ?? null,
           total: (roster ?? []).length, sizes, near, rows,
           // كل الطلاب بأيام غيابهم ومرات تأخرهم (لتقرير الانضباط بالصف والفصل)
           all: (roster ?? []).filter((s) => s.grade).map((s) => ({ student_id: s.student_id, full_name: s.full_name, grade: s.grade,
             class_no: s.class_no, abs: absDays.get(s.student_id) ?? 0, late: late.get(s.student_id) ?? 0 })) };
}
