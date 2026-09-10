import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function StudentHome() {
  const [grades, setGrades] = useState([]);
  const [days, setDays] = useState([]);

  useEffect(() => {
    (async () => {
      // RLS يضمن أن غير المنشور لا يصل أصلًا
      const { data: g } = await supabase
        .from("grades_records")
        .select("term, score, max_score, subjects(name)")
        .order("term");
      setGrades(g ?? []);

      const { data: d } = await supabase
        .from("daily_attendance")
        .select("attend_date, punch_time")
        .order("attend_date", { ascending: false })
        .limit(20);
      setDays(d ?? []);
    })();
  }, []);

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold">الرئيسية</h1>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">درجاتي</h2>
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
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">حضوري الصباحي</h2>
        {days.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted">لا توجد سجلات بعد.</p>
        ) : (
          days.map((d, i) => (
            <div key={i} className="flex items-center justify-between border-b border-line px-4 py-2.5 last:border-0">
              <span className="num text-sm">{d.attend_date}</span>
              <span className="num text-xs text-muted">
                {new Date(d.punch_time).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
