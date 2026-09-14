import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { todayDow, todayLabel, GRADE_NAMES } from "../lib/schoolTime";

const LABEL = { absent: "غائب", late: "متأخر", excused: "مستأذن" };
const TONE = {
  absent: "bg-absent/10 text-absent",
  late: "bg-late/10 text-late",
  excused: "bg-excused/10 text-excused",
};

export default function GuardianHome() {
  const [children, setChildren] = useState(null);
  const [active, setActive] = useState(null);
  const [info, setInfo] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [records, setRecords] = useState([]);
  const [grades, setGrades] = useState([]);
  const [punches, setPunches] = useState([]);
  const [loading, setLoading] = useState(false);

  const dow = todayDow();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("guardian_student")
        .select("students(id, full_name, national_id)");
      const list = (data ?? []).map((r) => r.students).filter(Boolean);
      setChildren(list);
      if (list.length) setActive(list[0]);
    })();
  }, []);

  useEffect(() => {
    if (!active) return;
    (async () => {
      setLoading(true);

      const { data: v } = await supabase
        .from("v_active_students")
        .select("class_no, grade")
        .eq("student_id", active.id)
        .maybeSingle();
      setInfo(v ?? null);

      const { data: sset } = await supabase
        .from("settings").select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((sset ?? []).map((r) => [r.key, r.value]));

      const { data: enr } = await supabase
        .from("student_enrollment")
        .select("class_id")
        .eq("student_id", active.id)
        .eq("status", "active")
        .maybeSingle();

      if (enr?.class_id && dow) {
        const { data: sch } = await supabase
          .from("schedule")
          .select("id, period_no, subjects(name), teachers(full_name)")
          .eq("class_id", enr.class_id)
          .eq("academic_year", m.active_year ?? "")
          .eq("term", Number(m.active_term ?? 1))
          .eq("day_of_week", dow)
          .order("period_no");
        setSchedule(sch ?? []);
      } else {
        setSchedule([]);
      }

      const [{ data: rec }, { data: g }, { data: d }] = await Promise.all([
        supabase.from("class_attendance")
          .select("attend_date, status, schedule(period_no, subjects(name))")
          .eq("student_id", active.id)
          .neq("status", "present")
          .order("attend_date", { ascending: false })
          .limit(40),
        supabase.from("grades_records")
          .select("term, score, max_score, subjects(name)")
          .eq("student_id", active.id)
          .order("term"),
        supabase.from("daily_attendance")
          .select("attend_date, punch_time")
          .eq("student_id", active.id)
          .order("attend_date", { ascending: false })
          .limit(15),
      ]);

      setRecords(rec ?? []);
      setGrades(g ?? []);
      setPunches(d ?? []);
      setLoading(false);
    })();
  }, [active, dow]);

  const totals = useMemo(() => {
    const c = { absent: 0, late: 0, excused: 0 };
    records.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [records]);

  if (children === null) {
    return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;
  }

  if (children.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">لا يوجد أبناء مرتبطون بحسابك</p>
        <p className="mt-1.5 text-sm text-muted">راجع إدارة المدرسة لربط أبنائك بحسابك.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c)}
              className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
                active?.id === c.id
                  ? "bg-mint-deep text-white"
                  : "border border-line bg-white text-muted hover:bg-canvas"
              }`}
            >
              {c.full_name}
            </button>
          ))}
        </div>
      )}

      <header>
        <h1 className="text-xl font-bold text-ink">{active?.full_name}</h1>
        {info && (
          <p className="mt-0.5 text-sm text-muted">
            {GRADE_NAMES[info.grade] ?? ""} · فصل <span className="num">{info.class_no}</span>
          </p>
        )}
      </header>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted">جارٍ التحميل…</p>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-3">
            {["absent", "late", "excused"].map((k) => (
              <div key={k} className="rounded-card border border-line bg-white px-4 py-4 text-center">
                <p className="num text-2xl font-bold leading-none text-mint-deep">{totals[k]}</p>
                <p className="mt-1.5 text-xs text-muted">{LABEL[k]}</p>
              </div>
            ))}
          </section>

          <section className="card overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
              جدول {todayLabel()}
            </h2>
            {!dow ? (
              <p className="px-4 py-5 text-sm text-muted">
                اليوم عطلة — الأسبوع الدراسي من الأحد إلى الخميس.
              </p>
            ) : schedule.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted">لا توجد حصص مسجّلة لهذا اليوم.</p>
            ) : (
              schedule.map((s) => (
                <div key={s.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
                  <span className="num w-8 shrink-0 rounded-md bg-mint-tint py-1 text-center text-xs font-bold text-mint-deep">
                    {s.period_no}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {s.subjects?.name ?? "—"}
                    </p>
                    <p className="truncate text-xs text-muted">{s.teachers?.full_name ?? "—"}</p>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="card overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
              الغياب والتأخر
            </h2>
            {records.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted">لا توجد حالات مسجّلة.</p>
            ) : (
              records.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0">
                  <div className="min-w-0">
                    <p className="num text-sm text-ink">{r.attend_date}</p>
                    <p className="truncate text-xs text-muted">
                      الحصة <span className="num">{r.schedule?.period_no ?? "—"}</span> ·{" "}
                      {r.schedule?.subjects?.name ?? "—"}
                    </p>
                  </div>
                  <span className={`chip shrink-0 ${TONE[r.status]}`}>{LABEL[r.status]}</span>
                </div>
              ))
            )}
          </section>

          <section className="card overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">الدرجات</h2>
            {grades.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted">لم تُنشر درجات بعد.</p>
            ) : (
              grades.map((g, i) => (
                <div key={i} className="flex items-center justify-between border-b border-line px-4 py-3 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-ink">{g.subjects?.name ?? "—"}</p>
                    <p className="text-xs text-muted">{g.term}</p>
                  </div>
                  <p className="num text-sm font-semibold text-mint-deep">
                    {g.score} / {g.max_score}
                  </p>
                </div>
              ))
            )}
          </section>

          <section className="card overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
              الحضور الصباحي
            </h2>
            {punches.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted">لا توجد سجلات بعد.</p>
            ) : (
              punches.map((d, i) => (
                <div key={i} className="flex items-center justify-between border-b border-line px-4 py-2.5 last:border-0">
                  <span className="num text-sm text-ink">{d.attend_date}</span>
                  <span className="num text-xs text-muted">
                    {new Date(d.punch_time).toLocaleTimeString("ar-SA", {
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
