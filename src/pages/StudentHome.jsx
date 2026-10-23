import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { todayDow, todayLabel, GRADE_NAMES } from "../lib/schoolTime";
import HolidayBanner from "../components/HolidayBanner.jsx";
import ColorLegend, { ATTENDANCE_LEGEND } from "../components/ColorLegend.jsx";
import { loadPeriodTimes, byPeriodNo, currentPeriodNo, fmtRange, fmtTime } from "../lib/periodTimes";
import { loadFingerprintPublic } from "../lib/officialAttendance";
import HeaderChips from "../components/HeaderChips.jsx";
import ExamDayCard from "../components/ExamDayCard.jsx";
import ConductMeter from "../components/ConductMeter.jsx";
import PeriodNoticeCard from "../components/PeriodNoticeCard.jsx";
import ResultsCard from "../components/ResultsCard.jsx";
import AttendanceLog from "../components/AttendanceLog.jsx";
import { GuidanceRequestCard } from "./GuidanceMore.jsx";
import OfficialLinks from "../components/OfficialLinks.jsx";
import TasksBox from "../components/TasksBox.jsx";
import MyQuizzesCard from "../components/MyQuizzesCard.jsx";
import LabSeatCard from "../components/LabSeatCard.jsx";
import LabRulesCard from "../components/LabRulesCard.jsx";
import BehaviorAckCard from "../components/BehaviorAckCard.jsx";
import Loader from "../components/Loader.jsx";

export default function StudentHome() {
  const { session, profile } = useSession();
  const [me, setMe] = useState(null);
  const [schedule, setSchedule] = useState([]);
  // البصمة المقفلة (مرحلة تجربة) لا تُعرض للطالب ولا لولي الأمر، وبعد فتحها
  // تُعرض بصمات ما بعد تاريخ الفتح فقط — لا بصمات أيام التجربة
  const [fp, setFp] = useState({ on: false, since: null });
  useEffect(() => { loadFingerprintPublic().then(setFp).catch(() => setFp({ on: false, since: null })); }, []);
  const [ptimes, setPtimes] = useState([]);
  const [nowPeriod, setNowPeriod] = useState(null);
  const [loading, setLoading] = useState(true);

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
      if (!uid) return;

      // بيانات الطالب
      const { data: st } = await supabase
        .from("students")
        .select("id, full_name, national_id")
        .eq("user_id", uid)
        .maybeSingle();

      if (!st) { setLoading(false); return; }

      // الفصل والصف
      const { data: info } = await supabase
        .from("v_active_students")
        .select("class_no, grade")
        .eq("student_id", st.id)
        .maybeSingle();

      setMe({ ...st, ...(info ?? {}) });

      // إعدادات العام والفصل
      const { data: sset } = await supabase
        .from("settings").select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((sset ?? []).map((r) => [r.key, r.value]));

      // جدول اليوم
      const { data: enr } = await supabase
        .from("student_enrollment")
        .select("class_id")
        .eq("student_id", st.id)
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
      }


      setLoading(false);
    })();
  }, [session, dow]);


  const ptMap = byPeriodNo(ptimes);

  if (loading) return <Loader />;

  if (!me) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">الحساب غير مرتبط بسجل طالب</p>
        <p className="mt-1.5 text-sm text-muted">راجع إدارة المدرسة.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-xl font-bold text-ink">{me.full_name}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {GRADE_NAMES[me.grade] ?? ""} · فصل <span className="num">{me.class_no}</span>
          </p>
        </div>
        <HeaderChips />
      </header>

      <HolidayBanner />

      <ExamDayCard />

      {/* الترتيب بالأولوية: ما ينتظر الطالب، ثم يومه، ثم حضوره، ثم نتائجه، ثم المرجع */}
      <TasksBox />
      <BehaviorAckCard />
      <LabRulesCard />

      {/* الاختبارات الإلكترونية ونتائجها في جدول واحد */}
      <MyQuizzesCard studentId={me.id} />

      <LabSeatCard />

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

      <AttendanceLog key={me.id} studentId={me.id} fp={fp} />

      <ColorLegend items={ATTENDANCE_LEGEND.slice(1)} />

      <ConductMeter studentId={me.id} />

      <PeriodNoticeCard studentId={me.id} />

      <ResultsCard studentId={me.id} />


      <GuidanceRequestCard studentId={me.id} requester="student" />
      <GuidanceRequestCard studentId={me.id} requester="student" target="deputy" />
      <OfficialLinks />
    </div>
  );
}
