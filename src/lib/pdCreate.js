// src/lib/pdCreate.js
import { supabase } from "./supabase";
import { loadActiveTerm } from "./officialAttendance";

/** نموذج تطوير مهني جديد من نوعه، أو مسودته الفارغة إن وُجدت (فلا تتراكم المسودات). يعيد { id } أو { error } */
export async function newPdReport({ kind, uid, name, deptId }) {
  const { data: mine } = await supabase.from("pd_reports").select("id, data, attendees, files, pd_signatures(user_id)")
    .eq("owner_user_id", uid).eq("kind", kind).eq("status", "draft").limit(20);
  const blank = (mine ?? []).find((r) => !(r.attendees ?? []).length && !(r.files ?? []).length && !(r.pd_signatures ?? []).length
    && Object.keys(r.data ?? {}).every((k) => k === "provider"));
  if (blank) return { id: blank.id };
  const { year } = await loadActiveTerm();
  const { data, error } = await supabase.from("pd_reports").insert({
    kind, owner_user_id: uid, owner_name: name ?? "", academic_year: year, department_id: deptId ?? null,
    data: ["training", "workshop"].includes(kind) ? { provider: "مدرسة مكة الثانوية" } : {},
  }).select("id").single();
  return error ? { error } : { id: data.id };
}
