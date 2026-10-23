// src/pages/MyWeek.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import WeeklyGrid from "../components/WeeklyGrid.jsx";
import Loader from "../components/Loader.jsx";

/* =====================================================================
   الجدول الأسبوعي — صفحة في القائمة الجانبية للطالب وولي الأمر بدل صندوق
   مطوي في الرئيسية: الطالب جدول فصله، وولي الأمر جدول كل ابن.
   ===================================================================== */
export default function MyWeek() {
  const { session, effectiveRole } = useSession();
  const uid = session?.user?.id;
  const [kids, setKids] = useState(null);
  const [active, setActive] = useState(null);
  const [rows, setRows] = useState(null);

  // الطالب نفسه، أو أبناء ولي الأمر
  useEffect(() => {
    if (!uid) return;
    (async () => {
      let list = [];
      if (effectiveRole === "student") {
        const { data } = await supabase.from("students").select("id, full_name").eq("user_id", uid).maybeSingle();
        if (data) list = [data];
      } else if (effectiveRole === "guardian") {
        const { data: g } = await supabase.from("guardians").select("id").eq("user_id", uid).maybeSingle();
        if (g) {
          const { data } = await supabase.from("guardian_student").select("students(id, full_name)").eq("guardian_id", g.id);
          list = (data ?? []).map((r) => r.students).filter(Boolean);
        }
      }
      setKids(list);
      setActive(list[0] ?? null);
    })();
  }, [uid, effectiveRole]);

  // جدول فصل الطالب في الفصل الدراسي النشط
  useEffect(() => {
    if (!active) return;
    setRows(null);
    (async () => {
      const { data: sset } = await supabase.from("settings").select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((sset ?? []).map((r) => [r.key, r.value]));
      const { data: enr } = await supabase.from("student_enrollment").select("class_id")
        .eq("student_id", active.id).eq("status", "active").maybeSingle();
      if (!enr?.class_id) { setRows([]); return; }
      const { data } = await supabase.from("schedule")
        .select("id, day_of_week, period_no, start_time, end_time, subjects(name), teachers(full_name)")
        .eq("class_id", enr.class_id).eq("academic_year", m.active_year ?? "").eq("term", Number(m.active_term ?? 1));
      setRows(data ?? []);
    })();
  }, [active]);

  if (!kids) return <Loader />;
  if (!kids.length) {
    return <div className="card px-6 py-12 text-center text-sm text-muted">لم يُربط الحساب بطالب بعد.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">الجدول الأسبوعي</h1>
        <p className="mt-1 text-sm text-muted">حصص الأسبوع كاملة بمعلميها في الفصل الدراسي الحالي.</p>
      </div>
      {kids.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {kids.map((k) => (
            <button key={k.id} onClick={() => setActive(k)}
              className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
                active?.id === k.id ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
              {k.full_name}
            </button>
          ))}
        </div>
      )}
      <section className="card p-4">
        {!rows ? <Loader compact /> : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">لا جدول مسجّل لهذا الفصل بعد.</p>
        ) : (
          <WeeklyGrid
            rows={rows}
            cell={(r) => (
              <div>
                <p className="text-xs font-bold text-ink">{r.subjects?.name}</p>
                <p className="text-[11px] text-muted">{r.teachers?.full_name}</p>
              </div>
            )}
          />
        )}
      </section>
    </div>
  );
}
