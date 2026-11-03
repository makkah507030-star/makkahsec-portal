// src/lib/deputyReferral.js
// إحالة يصدرها وكيل شؤون الطلاب مباشرة لموجه صف الطالب (بلا مرحلة المعلم)، ثم تسير في مسار
// الإحالة المعتاد: إجراء الموجه ← اعتماد الوكيل ← إشعار ولي الأمر.
//   • missing: طالب مفقود خلال اليوم (supabase/missing_to_counselor.sql)
//   • absence: غياب بدون عذر من صفحة الإنذارات لدراسة حالته (supabase/absence_to_counselor.sql)
import { supabase } from "./supabase";
import { GRADE_NAMES } from "./schoolTime";
import { notifyUsers } from "./referrals";

/** موجه الصف المسند (counselor_1..3)، أو null */
export async function gradeCounselor(grade) {
  if (!grade) return null;
  const { data } = await supabase.from("admin_roles")
    .select("user_id, users(full_name)").eq("role_type", `counselor_${grade}`).limit(1);
  const c = data?.[0];
  return c ? { id: c.user_id, name: c.users?.full_name ?? "" } : null;
}

/** صف الطالب وفصله من قيده النشط */
export async function studentClass(studentId) {
  const { data } = await supabase.from("student_enrollment")
    .select("classes(grade, class_no)").eq("status", "active").eq("student_id", studentId).limit(1);
  return data?.[0]?.classes ?? null;
}

export const classLabelOf = (grade, classNo) => `${GRADE_NAMES[grade] ?? ""} — فصل ${classNo ?? ""}`.trim();

/**
 * إنشاء الإحالة وإشعار الموجه. يُرجع { serial, counselor } أو يرمي خطأ برسالة عربية واضحة.
 * extra: حقول إضافية في الإحالة (subject, period_no, day_timeline, deputy_note …)
 */
export async function referToGradeCounselor({ profile, kind, student, grade, classNo, date, reason, extra = {}, notify }) {
  const c = await gradeCounselor(grade);
  if (!c) throw new Error(`لا يوجد موجه طلابي مسند للصف ${GRADE_NAMES[grade] ?? ""} — أسنده من «الإدارة» أولًا.`);
  const { data: serial } = await supabase.rpc("next_referral_serial");
  const { data: sig } = await supabase.from("user_signatures").select("path").eq("user_id", profile.id).maybeSingle();
  const classLabel = classLabelOf(grade, classNo);
  const { error } = await supabase.from("student_referrals").insert({
    serial, kind,
    student_id: student.id, student_name: student.name, class_label: classLabel, grade: grade ?? null,
    referral_date: date, reason,
    teacher_at: null,
    deputy_id: profile.id, deputy_name: profile.full_name ?? "", deputy_sig: sig?.path ?? null,
    deputy_at: new Date().toISOString(),
    counselor_id: c.id, counselor_name: c.name,
    status: "with_counselor",
    ...extra,
  });
  if (error) {
    const file = kind === "absence" ? "absence_to_counselor.sql" : "missing_to_counselor.sql";
    throw new Error(/kind|check|policy|row-level|day_timeline/i.test(error.message)
      ? `نفّذ ملف supabase/${file} أولًا من Supabase ← SQL Editor.` : error.message);
  }
  await notifyUsers([c.id], notify.title, `${notify.body} (${serial}).`, "/referrals");
  return { serial, counselor: c, classLabel };
}

/**
 * إحالة طالب مفقود (صندوق المفقودين في لوحة التحكم، و«المفقودون خلال اليوم» في شؤون الطلاب).
 * row: صف من missing_students (student_id, full_name, class_no, missing_period, last_seen_period, subject)، وgrade إن عُرف.
 * timeline: نتيجة student_day_timeline لليوم حتى لحظة التحويل.
 */
export async function referMissing({ profile, row: r, date, timeline }) {
  let grade = r.grade ?? null, classNo = r.class_no ?? null;
  if (!grade) { const c = await studentClass(r.student_id); grade = c?.grade ?? null; classNo = c?.class_no ?? classNo; }
  const dayTimeline = {
    punch_time: timeline?.[0]?.punch_time ?? null,
    missing_period: r.missing_period ?? null,
    periods: (timeline ?? [])
      .filter((x) => x.period_no != null)
      .map((x) => ({ period_no: x.period_no, subject: x.subject, teacher: x.teacher, status: x.status })),
  };
  const label = classLabelOf(grade, classNo);
  const out = await referToGradeCounselor({
    profile, kind: "missing", student: { id: r.student_id, name: r.full_name }, grade, classNo, date,
    reason: `فُقد الطالب من الحصة ${r.missing_period ?? "—"}${r.subject ? ` (${r.subject})` : ""} بعد حضوره الحصة ${r.last_seen_period ?? "—"}.`,
    extra: { day_timeline: dayTimeline, subject: r.subject ?? null, period_no: r.missing_period ?? null },
    notify: { title: "إحالة طالب مفقود",
      body: `أحال إليك وكيل شؤون الطلاب الطالب ${r.full_name} (${label}) لفقدانه من الحصة ${r.missing_period ?? ""}` },
  });
  // سجل الإجراء في صندوق المفقودين (يراه المعلم والصندوق)
  await supabase.from("admin_missing_notes").insert({ student_id: r.student_id, note_date: date, action: "to_counselor", created_by: profile.id });
  return out;
}
