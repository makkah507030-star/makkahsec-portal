import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { todayDow, todayLabel, GRADE_NAMES } from "../lib/schoolTime";
import WeeklyGrid from "../components/WeeklyGrid.jsx";
import ColorLegend, { ATTENDANCE_LEGEND } from "../components/ColorLegend.jsx";
import { loadPeriodTimes, byPeriodNo, currentPeriodNo, fmtRange, fmtTime } from "../lib/periodTimes";
import { loadFingerprintPublic } from "../lib/officialAttendance";
import ExamCountdown from "../components/ExamCountdown.jsx";
import ExamDayCard from "../components/ExamDayCard.jsx";
import HolidayBanner from "../components/HolidayBanner.jsx";
import ResultsCard from "../components/ResultsCard.jsx";
import AttendanceLog from "../components/AttendanceLog.jsx";
import { useSession } from "../lib/session.jsx";
import Loader from "../components/Loader.jsx";

export default function GuardianHome() {
  const { session } = useSession();
  const [children, setChildren] = useState(null);
  const [active, setActive] = useState(null);
  const [info, setInfo] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [weekSchedule, setWeekSchedule] = useState(null);
  const [showWeek, setShowWeek] = useState(false);
  // البصمة المقفلة (مرحلة تجربة) لا تُعرض للطالب ولا لولي الأمر، وبعد فتحها
  // تُعرض بصمات ما بعد تاريخ الفتح فقط — لا بصمات أيام التجربة
  const [fp, setFp] = useState({ on: false, since: null });
  useEffect(() => { loadFingerprintPublic().then(setFp).catch(() => setFp({ on: false, since: null })); }, []);
  const [ptimes, setPtimes] = useState([]);
  const [nowPeriod, setNowPeriod] = useState(null);
  const [loading, setLoading] = useState(false);

  const dow = todayDow();

  useEffect(() => {
    let timer;
    (async () => {
      const { rows } = await loadPeriodTimes();
      setPtimes(rows);
      const tick = () => setNowPeriod(currentPeriodNo(rows));
      tick();
      timer = setInterval(tick, 60000);
    })();
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid) { setChildren([]); return; }

      // نحدّد أولًا سجل ولي الأمر المرتبط بهذا الحساب، ثم أبناءه فقط —
      // لا نعتمد على RLS وحده لتضييق النتائج (أمان مضاعف على مستوى التطبيق)
      const { data: g } = await supabase
        .from("guardians").select("id").eq("user_id", uid).maybeSingle();

      if (!g) { setChildren([]); return; }

      const { data } = await supabase
        .from("guardian_student")
        .select("students(id, full_name, national_id)")
        .eq("guardian_id", g.id);

      const list = (data ?? []).map((r) => r.students).filter(Boolean);
      setChildren(list);
      if (list.length) setActive(list[0]);
    })();
  }, [session]);

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

      if (enr?.class_id) {
        const { data: week } = await supabase
          .from("schedule")
          .select("id, day_of_week, period_no, start_time, end_time, subjects(name), teachers(full_name)")
          .eq("class_id", enr.class_id)
          .eq("academic_year", m.active_year ?? "")
          .eq("term", Number(m.active_term ?? 1));
        setWeekSchedule(week ?? []);
      } else {
        setWeekSchedule([]);
      }

      setLoading(false);
    })();
  }, [active, dow]);


  const ptMap = byPeriodNo(ptimes);

  if (children === null) {
    return <Loader />;
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

      <HolidayBanner />

      <ExamDayCard />

      <ExamCountdown />

      <ResultsCard key={active?.id} studentId={active?.id} />

      {loading ? (
        <Loader />
      ) : (
        <>

          {/* جدول اليوم — لا يظهر إطلاقًا في أيام العطلة الأسبوعية */}
          {Boolean(dow) && (
            <section className="card overflow-hidden">
              <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
                جدول {todayLabel()}
              </h2>
              {schedule.length === 0 ? (
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
                      <p className="truncate text-xs text-muted">
                        {s.teachers?.full_name ?? "—"}
                        {ptMap[s.period_no] && (
                          <span className="num"> · {fmtRange(ptMap[s.period_no])}</span>
                        )}
                      </p>
                    </div>
                    {nowPeriod === s.period_no && (
                      <span className="chip shrink-0 bg-mint-deep text-white">الآن</span>
                    )}
                  </div>
                ))
              )}
            </section>
          )}

          <section className="card overflow-hidden">
            <button onClick={() => setShowWeek((v) => !v)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right">
              <h2 className="text-sm font-semibold text-ink">الجدول الأسبوعي الكامل</h2>
              <svg viewBox="0 0 24 24" fill="none"
                   className={`h-4 w-4 text-muted transition-transform ${showWeek ? "rotate-180" : ""}`}
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {showWeek && (
              <div className="border-t border-line p-4">
                {!weekSchedule ? (
                  <Loader compact />
                ) : (
                  <WeeklyGrid
                    rows={weekSchedule}
                    cell={(r) => (
                      <div>
                        <p className="text-xs font-bold text-ink">{r.subjects?.name}</p>
                        <p className="text-[11px] text-muted">{r.teachers?.full_name}</p>
                      </div>
                    )}
                  />
                )}
              </div>
            )}
          </section>

          <AttendanceLog key={active?.id} studentId={active?.id} fp={fp} />

          <ColorLegend items={ATTENDANCE_LEGEND.slice(1)} />
        </>
      )}
    </div>
  );
}
