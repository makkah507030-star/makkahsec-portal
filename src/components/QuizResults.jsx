// src/components/QuizResults.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";

/* =====================================================================
   نتائج الاختبارات القصيرة — للطالب وولي أمره.
   تظهر بعد أن يبدأ المعلم التصحيح، ولا تظهر قبله.
   ===================================================================== */

const PERIODS = { period1: "الفترة الأولى", period2: "الفترة الثانية", final: "النهائي" };

const fmtG = (s) => {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export default function QuizResults({ studentId = null, compact = false }) {
  const { session, effectiveRole } = useSession();
  const uid = session?.user?.id;

  const [kids, setKids] = useState([]);       // لولي الأمر
  const [current, setCurrent] = useState(studentId);
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      if (studentId) { setCurrent(studentId); return; }

      if (effectiveRole === "student") {
        const { data } = await supabase.from("students")
          .select("id, full_name").eq("user_id", uid).maybeSingle();
        if (data) { setKids([data]); setCurrent(data.id); }
        return;
      }

      if (effectiveRole === "guardian") {
        const { data: g } = await supabase.from("guardians")
          .select("id").eq("user_id", uid).maybeSingle();
        if (!g) return;
        const { data: link } = await supabase.from("guardian_student")
          .select("students(id, full_name)").eq("guardian_id", g.id);
        const list = (link ?? []).map((x) => x.students).filter(Boolean);
        setKids(list);
        setCurrent(list[0]?.id ?? null);
      }
    })();
  }, [uid, effectiveRole, studentId]);

  useEffect(() => {
    if (!current) { setRows([]); return; }
    (async () => {
      const { data } = await supabase.rpc("my_quiz_results", { p_student: current });
      setRows(data ?? []);
    })();
  }, [current]);

  if (!rows || rows.length === 0) return null;

  const shown = compact ? rows.slice(0, 3) : rows;
  const graded = rows.filter((r) => !r.absent && r.score != null);
  const avg = graded.length
    ? Math.round((graded.reduce((a, r) => a + (100 * Number(r.score) / Number(r.total)), 0)
        / graded.length) * 10) / 10
    : null;

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink">نتائج الاختبارات القصيرة</p>
          {avg !== null && (
            <p className="num mt-0.5 text-xs text-muted">
              المتوسط العام: <span className="font-semibold text-mint-deep">{avg}%</span>
              {" · "}{graded.length} اختبارًا
            </p>
          )}
        </div>
      </div>

      {kids.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {kids.map((k) => (
            <button key={k.id} onClick={() => setCurrent(k.id)}
              className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                current === k.id ? "bg-mint-deep text-white"
                                 : "border border-line bg-white text-muted"}`}>
              {k.full_name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {shown.map((r) => {
          const pct = r.absent || r.score == null
            ? null : Math.round((Number(r.score) / Number(r.total)) * 100);
          const tone = pct == null ? "text-muted"
            : pct >= 80 ? "text-present" : pct >= 50 ? "text-mint-deep" : "text-warning";
          return (
            <div key={r.quiz_id}
                 className="flex items-center gap-3 rounded-sm2 border border-line px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{r.title}</p>
                <p className="num mt-0.5 text-[11px] text-faint">
                  {r.subject_name || "—"} · {PERIODS[r.period] ?? ""}
                  {r.exam_date ? ` · ${fmtG(r.exam_date)}` : ""}
                </p>
              </div>
              {r.absent ? (
                <span className="chip shrink-0 bg-absent/10 text-absent">غائب</span>
              ) : (
                <div className="shrink-0 text-center">
                  <p className={`num text-sm font-bold ${tone}`}>
                    {r.score} <span className="text-[11px] font-normal text-faint">/ {r.total}</span>
                  </p>
                  {pct != null && <p className={`num text-[11px] ${tone}`}>{pct}%</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {compact && rows.length > 3 && (
        <p className="num mt-2 text-center text-[11px] text-faint">
          و{rows.length - 3} اختبارات أخرى
        </p>
      )}
    </section>
  );
}
