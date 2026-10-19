// src/components/QuizTeacherPicker.jsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { byName } from "../lib/sortAr.js";

/* =====================================================================
   اطلاع الدعم الفني على «التصحيح والدرجات» و«تحليل النتائج»:
   يختار المعلم فتظهر اختباراته ودرجاتها كما يراها المعلم، للاطلاع فقط
   (لا رصد ولا إعادة تصحيح)، لمتابعة الإجراءات ومعرفة موضع خلل الإحصاء.
   القراءة تسمح بها سياسات الاختبارات أصلًا لـ tech_support.
   المعلم المختار في الرابط (?t=) فيبقى عند التحديث.
   ===================================================================== */

export function useQuizTeacher() {
  const { session, profile, adminRoles, effectiveRole } = useSession();
  const isTech = effectiveRole === "admin" && (adminRoles ?? []).includes("tech_support");
  const [params, setParams] = useSearchParams();
  const [teachers, setTeachers] = useState(null);

  useEffect(() => {
    if (!isTech) return;
    (async () => {
      const { data: qz } = await supabase.from("quizzes").select("teacher_id").limit(10000);
      const ids = [...new Set((qz ?? []).map((q) => q.teacher_id).filter(Boolean))];
      const n = {};
      (qz ?? []).forEach((q) => { n[q.teacher_id] = (n[q.teacher_id] ?? 0) + 1; });
      const list = [];
      for (let i = 0; i < ids.length; i += 300) {
        const { data: ts } = await supabase.from("teachers").select("user_id, full_name").in("user_id", ids.slice(i, i + 300));
        (ts ?? []).forEach((t) => list.push({ id: t.user_id, full_name: t.full_name, n: n[t.user_id] ?? 0 }));
      }
      setTeachers(list.sort(byName()));
    })();
  }, [isTech]);

  if (!isTech) return { viewOnly: false, teacherId: session?.user?.id, teacherName: profile?.full_name ?? "" };
  const teacherId = params.get("t") ?? "";
  const pick = (id) => {
    const p = new URLSearchParams(params);
    if (id) p.set("t", id); else p.delete("t");
    p.delete("q");
    setParams(p, { replace: true });
  };
  return {
    viewOnly: true, teacherId, teachers, pick,
    teacherName: (teachers ?? []).find((t) => t.id === teacherId)?.full_name ?? "",
  };
}

export default function QuizTeacherPicker({ t }) {
  if (!t.viewOnly) return null;
  return (
    <section className="no-print card space-y-2 p-4">
      <label className="text-xs text-muted">المعلم</label>
      <select className="field w-full" value={t.teacherId} onChange={(e) => t.pick(e.target.value)}>
        <option value="">{t.teachers ? "اختر المعلم…" : "جارٍ التحميل…"}</option>
        {(t.teachers ?? []).map((x) => <option key={x.id} value={x.id}>{x.full_name} ({x.n})</option>)}
      </select>
      <p className="text-[11.5px] text-faint">للاطلاع فقط: تظهر الدرجات كما يراها المعلم، ولا يُعدَّل منها شيء.</p>
    </section>
  );
}
