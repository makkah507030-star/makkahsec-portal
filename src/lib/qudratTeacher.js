// src/lib/qudratTeacher.js
/* =====================================================================
   المعلم المعني بمركز التدريب (القدرات): من يدرّس الرياضيات (القسم الكمي) أو اللغة العربية
   (القسم اللفظي) في جدوله للعام الحالي، بالمطابقة نفسها التي يُوجَّه بها سؤال الطالب لمعلمه
   (qudrat_route_teacher في supabase/qudrat_3.sql). يضيف أسئلة قسمه وحده، ولا يرى بيانات استخدام الطلاب.
   ===================================================================== */
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export const QUDRAT_SUBJECT = { quant: /رياضيات/, verbal: /(لغوية|لغتي|عربية|العربية|نحو|بلاغة)/ };

/** أقسام القدرات التي يخدمها المعلم: ["quant"] أو ["verbal"] أو كلاهما أو [] */
export async function loadQudratSecs(uid) {
  if (!uid) return [];
  const { data: t } = await supabase.from("teachers").select("id").eq("user_id", uid).maybeSingle();
  if (!t) return [];
  const { data: st } = await supabase.from("settings").select("value").eq("key", "active_year").maybeSingle();
  let q = supabase.from("schedule").select("subjects(name)").eq("teacher_id", t.id);
  if (st?.value) q = q.eq("academic_year", st.value);
  const { data } = await q;
  const names = (data ?? []).map((r) => r.subjects?.name ?? "");
  return Object.keys(QUDRAT_SUBJECT).filter((s) => names.some((n) => QUDRAT_SUBJECT[s].test(n)));
}

/** للمعلم: أقسامه (null أثناء التحميل). ولغير المعلم: [] */
export function useQudratSecs(uid, isTeacherView) {
  const [secs, setSecs] = useState(isTeacherView ? null : []);
  useEffect(() => {
    if (!isTeacherView) { setSecs([]); return; }
    let alive = true;
    loadQudratSecs(uid).then((s) => { if (alive) setSecs(s); });
    return () => { alive = false; };
  }, [uid, isTeacherView]);
  return secs;
}
