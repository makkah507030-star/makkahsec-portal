import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function GuardianHome() {
  const [children, setChildren] = useState([]);
  const [active, setActive] = useState(null);
  const [grades, setGrades] = useState([]);
  const [absences, setAbsences] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("guardian_student")
        .select("students(id, full_name)");
      const list = (data ?? []).map((r) => r.students).filter(Boolean);
      setChildren(list);
      if (list.length) setActive(list[0]);
    })();
  }, []);

  useEffect(() => {
    if (!active) return;
    (async () => {
      const { data: g } = await supabase
        .from("grades_records")
        .select("term, score, max_score, subjects(name)")
        .eq("student_id", active.id);
      setGrades(g ?? []);

      const { data: a } = await supabase
        .from("class_attendance")
        .select("attend_date, status")
        .eq("student_id", active.id)
        .neq("status", "present")
        .order("attend_date", { ascending: false })
        .limit(30);
      setAbsences(a ?? []);
    })();
  }, [active]);

  const LABEL = { absent: "غائب", late: "متأخر", excused: "مستأذن" };
  const TONE = { absent: "text-absent", late: "text-late", excused: "text-excused" };

  if (!children.length) {
    return <p className="text-sm text-muted">لا يوجد أبناء مرتبطون بحسابك. راجع الإدارة.</p>;
  }

  return (
    <div className="space-y-5">
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c)}
              className={
                active?.id === c.id
                  ? "rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white"
                  : "rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-medium"
              }
            >
              {c.full_name}
            </button>
          ))}
        </div>
      )}

      <h1 className="text-lg font-bold">{active?.full_name}</h1>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">الدرجات</h2>
        {grades.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted">لم تُنشر درجات بعد.</p>
        ) : (
          grades.map((g, i) => (
            <div key={i} className="flex items-center justify-between border-b border-line px-4 py-3 last:border-0">
              <div>
                <p className="text-sm font-medium">{g.subjects?.name ?? "—"}</p>
                <p className="text-xs text-muted">{g.term}</p>
              </div>
              <p className="num text-sm font-semibold">{g.score} / {g.max_score}</p>
            </div>
          ))
        )}
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">الغياب والتأخر</h2>
        {absences.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted">لا توجد حالات مسجّلة.</p>
        ) : (
          absences.map((a, i) => (
            <div key={i} className="flex items-center justify-between border-b border-line px-4 py-2.5 last:border-0">
              <span className="num text-sm">{a.attend_date}</span>
              <span className={`text-sm font-medium ${TONE[a.status]}`}>{LABEL[a.status]}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
