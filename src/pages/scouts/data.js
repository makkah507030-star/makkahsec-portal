// src/pages/scouts/data.js
import { supabase } from "../../lib/supabase";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { byClassName } from "../../lib/sortAr.js";

/* بيانات الفريق المشتركة بين صفحاته: الأعضاء بمناصبهم وطلائعهم وفصولهم، والطلائع
   (supabase/scouts_5.sql). setup: رسالة إن لم يُشغَّل الملف بعد. */
export const SETUP_MSG = "هذه الصفحة تحتاج تشغيل ملفات supabase/scouts_5.sql ثم scouts_6.sql ثم scouts_7.sql في Supabase ← SQL Editor.";
export const isSetupErr = (e) => /scout_|post|patrol|schema cache|relation|function/i.test(e?.message ?? "");

export async function loadTeam() {
  const [m, p] = await Promise.all([
    supabase.from("scout_members").select("*, students(full_name, student_enrollment(status, classes(grade, class_no)))"),
    supabase.from("scout_patrols").select("*").order("sort").order("created_at"),
  ]);
  const err = m.error ?? p.error;
  const members = (m.data ?? []).map((r) => {
    const en = (r.students?.student_enrollment ?? []).find((e) => e.status === "active");
    return { id: r.student_id, name: r.students?.full_name ?? "—", full_name: r.students?.full_name ?? "",
             grade: en?.classes?.grade, class_no: en?.classes?.class_no,
             cls: en ? `${GRADE_NAMES[en.classes?.grade]?.replace(" الثانوي", "") ?? ""} / ${en.classes?.class_no ?? ""}` : "—",
             post: r.post ?? "member", patrol_id: r.patrol_id ?? null, can_attend: r.can_attend ?? true };
  }).sort(byClassName());
  return { members, patrols: p.data ?? [], err: err && isSetupErr(err) ? SETUP_MSG : err?.message ?? null };
}
