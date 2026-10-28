// src/pages/admin/MonitorScreen.jsx
/* =====================================================================
   شاشة المتابعة — الوضع اليومي للمدرسة في شاشة كاملة، للمدير والوكيلين والدعم الفني.
   أرقام كبيرة تُقرأ من بعيد، ورسوم للحضور حسب الفصول واتجاهه، وما يجري الآن.
   تُعرض أمام الضيوف: أرقام ورسوم فقط، بلا أي اسم طالب. تتحدّث كل دقيقة.
   البيانات من الجداول القائمة (loadDay وغيرها)، فلا تحتاج SQL.
   ===================================================================== */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { todayISO, todayOff, nextHoliday, GRADE_NAMES } from "../../lib/schoolTime";
import { EXAM_DATE } from "../../components/ExamCountdown.jsx";
import { fmtHijri, fmtGreg } from "../../lib/dates";
import { loadPeriodTimes, toMinutes, currentSlot } from "../../lib/periodTimes";
import { loadDay, summarize } from "../../lib/officialAttendance";
import { OPEN_STATUSES } from "../../lib/referrals.js";
import { Icon } from "../../components/Layout.jsx";
import iconMint from "../../assets/icon-mint.png";
import iconWhite from "../../assets/icon-white.png";
import { academicYearLabel } from "../studio/lib";
import { loadStudyWeek } from "../../components/StudyWeekCard.jsx";
import { weekWord } from "../../lib/dfile.js";

// ألوان الحالة من هوية البوابة (index.css)، وتتبدّل قيمها بالوضع الفاتح أو الداكن (THEMES)
const C = { ok: "var(--m-ok)", warn: "var(--m-warn)", bad: "var(--m-bad)", info: "var(--m-info)", mint: "var(--m-accent)", dim: "var(--m-faint)" };
// النسختان الفاتحة والغامقة من هوية استوديو البوابة (studio/studio.css: .stu-light و.stu-dark)
const THEMES = {
  light: { "--m-bg": "radial-gradient(ellipse 90% 55% at 95% 0%, #DDF3E6 0%, transparent 60%), linear-gradient(160deg, #F2FAF5 0%, #F8FBF9 45%, #EDF6F0 100%)",
           "--m-lines": "rgba(62,99,80,.04)", "--m-shape": "rgba(62,99,80,.07)", "--m-blob": "rgba(137,215,173,.4)",
           "--m-card": "rgba(255,255,255,.85)", "--m-line": "#D5E7DC", "--m-track": "#E1EEE6", "--m-text": "#1C3328",
           "--m-sub": "#5E7268", "--m-faint": "#8FA398", "--m-ok": "#3E8A62", "--m-warn": "#B8912F", "--m-bad": "#A23B3B",
           "--m-info": "#3F6B99", "--m-accent": "#3E8A62", "--m-head": "#1C3328", "--m-gold": "#B8912F", "--m-pill": "rgba(62,99,80,.35)", "--m-on": "#FFFFFF" },
  dark:  { "--m-bg": "radial-gradient(ellipse 90% 55% at 95% 0%, #2f5240 0%, transparent 60%), linear-gradient(160deg, #284836 0%, #193326 42%, #12261c 72%, #0e1f17 100%)",
           "--m-lines": "rgba(255,255,255,.03)", "--m-shape": "rgba(120,170,140,.14)", "--m-blob": "rgba(96,150,118,.3)",
           "--m-card": "rgba(255,255,255,.05)", "--m-line": "rgba(255,255,255,.14)", "--m-track": "rgba(255,255,255,.1)", "--m-text": "#FFFFFF",
           "--m-sub": "#A9BCB1", "--m-faint": "#7E9488", "--m-ok": "#89D7AD", "--m-warn": "#D9B45A", "--m-bad": "#E58A7E",
           "--m-info": "#9CC0E6", "--m-accent": "#89D7AD", "--m-head": "#FFFFFF", "--m-gold": "#D9B45A", "--m-pill": "rgba(255,255,255,.3)", "--m-on": "#193326" },
};
const savedTheme = () => { try { return localStorage.getItem("monitor.theme") === "dark" ? "dark" : "light"; } catch { return "light"; } };
const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const toneOf = (pct) => (pct == null ? C.dim : pct >= 95 ? C.ok : pct >= 90 ? C.warn : C.bad);
const pctOf = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

// عدد الصفوف بلا جلب البيانات نفسها (head)، ويُعدّ صفرًا إن لم يوجد الجدول
const countOf = async (q) => { const { count, error } = await q; return error ? null : count ?? 0; };

function useMonitor() {
  const [d, setD] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    let live = true;
    const date = todayISO();
    // يوم الأسبوع بترقيم جدول الإشراف: الأحد = 1 … الخميس = 5 (كما في todayDow)
    const dow = new Date(date + "T12:00:00").getDay() + 1;
    const start = new Date(date + "T00:00:00").toISOString();
    const week = new Date(new Date(date + "T12:00:00").getTime() + 7 * 864e5).toISOString().slice(0, 10);
    (async () => {
      // الأعداد كاملة من monitor_counts.sql لكل من تظهر له الشاشة؛ وقبل تشغيله تُقرأ بصلاحيات الحساب
      const { data: mc } = await supabase.rpc("monitor_counts", { p_date: date });
      const ev = (k) => ({ data: mc[k] });
      const [day, pt, trend, perms, refsToday, refsOpen, behavior, duty, supervision, events, quizzes, notes, nextEvents, nextQuizzes,
             toGuardians, absenceNotes, invites, guardianForms, circs] = await Promise.all([
        todayOff() ? null : loadDay(date).catch(() => null),
        loadPeriodTimes().then((r) => r.rows).catch(() => []),
        supabase.from("official_attendance_days").select("attend_date, official_pct, late_count")
          .lt("attend_date", date).order("attend_date", { ascending: false }).limit(10),
        supabase.from("permission_requests").select("id, permission_request_students(student_id)").eq("request_date", date),
        mc ? mc.refsToday : countOf(supabase.from("student_referrals").select("id", { count: "exact", head: true }).eq("referral_date", date)),
        mc ? mc.refsOpen : countOf(supabase.from("student_referrals").select("id", { count: "exact", head: true }).in("status", OPEN_STATUSES)),
        mc ? mc.behavior : countOf(supabase.from("behavior_forms").select("id", { count: "exact", head: true }).gte("created_at", start)),
        supabase.from("duty_roster").select("name_a, name_b").eq("duty_date", date),
        supabase.from("supervision_duty").select("person_name, kind").eq("day_of_week", dow),
        mc ? ev("events") : supabase.from("school_events").select("title, category, event_date, end_date, start_time, venue")
          .lte("event_date", date).neq("stage", "draft").is("cancelled_at", null).order("event_date", { ascending: false }).limit(30),
        mc ? mc.quizzes : countOf(supabase.from("quizzes").select("id", { count: "exact", head: true }).eq("exam_date", date).neq("status", "draft")),
        mc ? mc.notes : countOf(supabase.from("notifications").select("id", { count: "exact", head: true }).gte("created_at", start)),
        mc ? ev("nextEvents") : supabase.from("school_events").select("title, category, event_date, start_time").gt("event_date", date).lte("event_date", week)
          .neq("stage", "draft").is("cancelled_at", null).order("event_date", { ascending: true }).limit(6),
        mc ? mc.nextQuizzes : countOf(supabase.from("quizzes").select("id", { count: "exact", head: true }).gt("exam_date", date).lte("exam_date", week).neq("status", "draft")),
        // التواصل مع أولياء الأمور: ما وصلهم من إشعارات، وإشعارات الغياب، والدعوات والمقابلات، والتعاميم
        mc ? mc.toGuardians : countOf(supabase.from("notification_recipients").select("notification_id, notifications!inner(created_at), users!inner(role)", { count: "exact", head: true })
          .gte("notifications.created_at", start).eq("users.role", "guardian")),
        mc ? mc.absenceNotes : countOf(supabase.from("official_absence_notified").select("student_id", { count: "exact", head: true }).eq("attend_date", date)),
        mc ? mc.invites : countOf(supabase.from("behavior_forms").select("id", { count: "exact", head: true }).in("kind", ["invite", "notice"]).gte("created_at", start)),
        mc ? mc.guardianForms : countOf(supabase.from("form_documents").select("id, form_templates!inner(key)", { count: "exact", head: true })
          .in("form_templates.key", ["guidance_guardian_call", "guidance_guardian_meeting"]).gte("created_at", start)),
        mc ? mc.circs : countOf(supabase.from("circulars").select("id", { count: "exact", head: true }).gte("sent_at", start)),
      ]);
      if (!live) return;
      const permStudents = new Set((perms.data ?? []).flatMap((p) => (p.permission_request_students ?? []).map((x) => x.student_id)));
      setD({
        date, day, pt, trend: [...(trend.data ?? [])].reverse(),
        perms: { requests: (perms.data ?? []).length, students: permStudents.size },
        refsToday, refsOpen, behavior,
        // المناوبة منفصلة عن الإشراف اليومي؛ والإشراف: المشرفون المتابعون ثم المعلمون، بلا تكرار
        duty: [...new Set((duty.data ?? []).flatMap((r) => [r.name_a, r.name_b]).filter(Boolean))],
        sup: uniqNames((supervision.data ?? []).filter((r) => r.kind === "supervisor")),
        supT: uniqNames((supervision.data ?? []).filter((r) => r.kind !== "supervisor")),
        events: (events.data ?? []).filter((e) => e.event_date === date || (e.end_date && e.end_date >= date)),
        quizzes, notes,
        comm: { toGuardians, absenceNotes, invites, guardianForms, circs }, nextEvents: nextEvents.data ?? [], nextQuizzes, at: new Date(),
      });
    })();
    return () => { live = false; };
  }, [tick]);
  return d;
}

export default function MonitorScreen() {
  const d = useMonitor();
  const [full, setFull] = useState(false);
  // الخلفية: فاتح أو داكن بهوية البوابة، ويُتذكّر الاختيار في المتصفح
  const [theme, setTheme] = useState(savedTheme);
  const flipTheme = () => { const t = theme === "dark" ? "light" : "dark"; setTheme(t); try { localStorage.setItem("monitor.theme", t); } catch { /* لا شيء */ } };
  const [clock, setClock] = useState(new Date());
  // الأسبوع الدراسي (كبطاقة الرئيسية): رقمه من بداية الفصل، أو اسم الإجازة التي تغطيه
  const [week, setWeek] = useState(null);
  const today = todayISO();
  useEffect(() => { loadStudyWeek(today).then(setWeek).catch(() => setWeek(null)); }, [today]);
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setFull(false); };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFull = () => {
    if (full) { document.exitFullscreen?.().catch(() => {}); setFull(false); }
    else { document.documentElement.requestFullscreen?.().catch(() => {}); setFull(true); }
  };

  const m = useMemo(() => (d ? model(d) : null), [d]);
  const off = todayOff();
  const slot = d ? currentSlot(d.pt, clock) : null;

  return (
    <div dir="rtl" className={`${full ? "fixed inset-0 z-[70] overflow-auto" : "relative -mx-4 -mt-5 sm:-mx-6"} isolate min-h-full p-4 text-[var(--m-text)] sm:p-6`} style={{ ...THEMES[theme], background: "var(--m-bg)" }}>
      {/* زخارف الهوية كما في أوراق الاستوديو: خطوط مائلة، وهالة، ومكعبان */}
      <div aria-hidden className={`pointer-events-none ${full ? "fixed" : "absolute"} inset-0 -z-10 overflow-hidden`}>
        <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(135deg, var(--m-lines) 0 1.5px, transparent 1.5px 22px)" }} />
        <div className="absolute h-[520px] w-[520px] rounded-full" style={{ background: "var(--m-blob)", filter: "blur(110px)", left: 80, top: 260 }} />
        <div className="absolute h-[440px] w-[440px] rounded-[76px]" style={{ background: "var(--m-shape)", transform: "rotate(32deg) skewX(-14deg)", filter: "blur(3px)", left: -230, bottom: -150 }} />
        <div className="absolute h-[440px] w-[440px] rounded-[76px] opacity-70" style={{ background: "var(--m-shape)", transform: "rotate(32deg) skewX(-14deg)", filter: "blur(3px)", left: -190, bottom: -300 }} />
      </div>
      {/* الترويسة: شريط البوابة كما في الاستوديو */}
      {/* الرأس ثلاثة أعمدة: الهوية والعام والأسبوع يمينًا، والساعة في المنتصف، والحصة والأزرار يسارًا */}
      <header className="grid grid-cols-1 items-center gap-4 pb-3 lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <img src={theme === "dark" ? iconWhite : iconMint} alt="" className="h-12 w-12 object-contain" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[var(--m-head)] sm:text-2xl">بوابة مكة الثانوية الرقمية</h1>
            <p className="text-sm text-[var(--m-sub)]">مدرسة مكة الثانوية · <span className="font-semibold text-[var(--m-accent)]">شاشة المتابعة اليومية</span></p>
          </div>
          <span className="hidden rounded-pill border-[1.5px] px-4 py-1 text-sm font-semibold sm:inline" style={{ borderColor: "var(--m-pill)", color: "var(--m-accent)" }}>
            <span className="num">{academicYearLabel()}</span></span>
          {week && (week.n > 0 || week.holiday) && (
            <span className="rounded-pill px-4 py-1.5 text-center text-sm font-bold" style={{ background: "var(--m-track)", color: "var(--m-head)" }}>
              {week.holiday ?? <>الأسبوع <span style={{ color: "var(--m-accent)" }}>{weekWord(week.n)}</span>
                {week.total ? <span className="mr-1 text-xs font-medium text-[var(--m-sub)]">من <span className="num">{week.total}</span></span> : null}</>}
            </span>
          )}
        </div>
        <div className="text-center">
          <p className="text-4xl font-bold tracking-wide sm:text-5xl"><Clock t={clock} /></p>
          <p className="mt-1 text-xs text-[var(--m-sub)] sm:text-sm">{WEEKDAYS[clock.getDay()]} · <span className="num">{fmtHijri(clock)}</span> هـ · <span className="num">{fmtGreg(clock)}</span> م</p>
        </div>
        <div className="flex flex-col items-center gap-2 lg:items-end">
          <SlotPill slot={slot} clock={clock} />
          <div className="flex gap-1.5">
          <button onClick={flipTheme} title="تغيير الخلفية" className="flex items-center gap-1.5 rounded-pill border border-[var(--m-line)] px-3 py-1 text-xs text-[var(--m-sub)] hover:bg-[var(--m-track)]">
            <span className="h-3 w-3 rounded-full border border-[var(--m-line)]" style={{ background: theme === "dark" ? "#F4F4F4" : "#111513" }} />
            {theme === "dark" ? "خلفية فاتحة" : "خلفية داكنة"}
          </button>
          <button onClick={toggleFull} className="flex items-center gap-1.5 rounded-pill border border-[var(--m-line)] px-3 py-1 text-xs text-[var(--m-sub)] hover:bg-[var(--m-track)]">
            <Icon name={full ? "panel" : "monitor"} className="h-4 w-4" /> {full ? "الخروج من ملء الشاشة" : "ملء الشاشة"}
          </button>
          </div>
        </div>
      </header>

      <div className="h-[1.5px]" style={{ background: "linear-gradient(90deg, transparent, var(--m-gold), transparent)" }} />
      {!d ? <p className="py-24 text-center text-[var(--m-sub)]">جارٍ تحميل بيانات اليوم…</p> : (
        <div className="mt-5 space-y-5">
          {off && <p className="rounded-card bg-[var(--m-track)] px-4 py-3 text-center text-[var(--m-sub)]">{off.title} — {off.body}</p>}

          {/* الصف الأول: الأرقام الكبرى */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Big title="نسبة الحضور اليوم" value={m.pct == null ? "—" : `${m.pct}%`} color={toneOf(m.pct)} ring={m.pct}
              sub={m.yPct != null ? `أمس ${m.yPct}% · متوسط الأيام العشرة ${m.avg}%` : "—"} />
            <Big title="الغياب" value={m.absent} color={m.absent ? C.bad : C.ok} icon="userX"
              sub={`بلا عذر · بعذر ${m.excused}${m.conflicts ? ` · بصم ولم يحضر ${m.conflicts}` : ""}`} />
            <Big title="التأخر الصباحي" value={m.fp ? m.late : "—"} color={m.late > 20 ? C.bad : m.late ? C.warn : C.ok} icon="clock"
              sub={m.fp ? (m.lateTop ? `أكثرها: ${m.lateTop}` : "لا تأخر") : "البصمة مقفلة"} />
            <Big title="التحضير في الحصص" value={m.mark.total ? `${m.mark.pct}%` : "—"} color={toneOf(m.mark.pct)} icon="clipboard"
              sub={m.mark.total ? `${m.mark.done} من ${m.mark.total} حصة حتى الآن` : "لم تبدأ الحصص"} />
            <Big title="الاستئذان" value={d.perms.students} color={d.perms.students ? C.warn : C.ok} icon="ticket"
              sub={`طالبًا في ${d.perms.requests} طلب`} />
          </div>

          {/* الصف الثاني: الرسوم */}
          <div className="grid gap-3 xl:grid-cols-3">
            <Panel title="الحضور حسب الفصول" className="xl:col-span-2"
              note="الحضور الرسمي لكل فصل حُضّر: الحاضر من حضر الحصة الأولى أو الثانية، والغائب من غاب عنهما معًا.">
              {m.classes.length ? <ClassBars rows={m.classes} /> : <Dim>لا تحضير بعد اليوم.</Dim>}
            </Panel>
            <Panel title="اتجاه الحضور: آخر الأيام الدراسية"
              note="النسبة الرسمية المعتمدة لآخر عشرة أيام دراسية، والنقطة الكبيرة نسبة اليوم حتى الآن.">
              {m.series.length > 1 ? <Trend points={m.series} /> : <Dim>لا أيام معتمدة كافية.</Dim>}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {m.grades.map((g) => (
                  <div key={g.grade} className="rounded-sm2 bg-[var(--m-track)] px-2 py-2 text-center">
                    <p className="num text-lg font-bold" style={{ color: toneOf(g.pct) }}>{g.pct == null ? "—" : `${g.pct}%`}</p>
                    <p className="text-[11px] text-[var(--m-sub)]">{GRADE_NAMES[g.grade] ?? g.grade}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* الصف الثالث: الانضباط، والإشراف اليومي (المشرفون أعلاه)، والمناوبة */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Panel title="الانضباط" icon="flag">
              <Mini rows={[["إحالات اليوم", d.refsToday], ["إحالات قيد المتابعة", d.refsOpen, d.refsOpen ? C.warn : C.ok], ["نماذج سلوك اليوم", d.behavior]]} />
            </Panel>
            <Panel title="الإشراف اليومي" icon="whistle" className="md:col-span-2">
              {d.sup.length || d.supT.length ? <SupervisionList sup={d.sup} teachers={d.supT} /> : <Dim>لا إشراف مسجّل اليوم.</Dim>}
            </Panel>
            <Panel title="المناوبة" icon="whistle">
              {d.duty.length ? <DutyList names={d.duty} /> : <Dim>لا مناوبين مسجّلين اليوم.</Dim>}
            </Panel>
          </div>

          {/* الصف الرابع: اليوم في المدرسة، والتواصل، والتحضير حسب الحصة، والقادم */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Panel title="اليوم في المدرسة" icon="calendar">
              <Mini rows={[["اختبارات مجدولة", d.quizzes], ["فعاليات جارية", d.events.length]]} />
              {d.events.slice(0, 2).map((e) => <p key={e.title} className="mt-2 truncate text-xs text-[var(--m-sub)]">• {e.title}</p>)}
            </Panel>
            <Panel title="التواصل" icon="bell">
              <Mini rows={[["إشعارات البوابة اليوم", d.notes], ["وصلت أولياء الأمور", d.comm.toGuardians],
                ["إشعارات غياب لأولياء الأمور", d.comm.absenceNotes], ["دعوات وإشعارات سلوكية", d.comm.invites],
                ["استدعاء أو مقابلة ولي أمر", d.comm.guardianForms], ["تعاميم أُرسلت", d.comm.circs]].filter((r) => r[1] != null)} small />
            </Panel>
            <Panel title="التحضير حسب الحصة" icon="clipboard">
              {m.byPeriod.length ? <PeriodBars rows={m.byPeriod} mark={m.mark} /> : <Dim>لا جدول لليوم.</Dim>}
            </Panel>
            <Panel title="القادم" icon="calendar">
              <Upcoming d={d} />
            </Panel>
          </div>

          {/* الصف الخامس: الخط الزمني لليوم بعرض الشاشة */}
          <Panel title="اليوم الدراسي" icon="clock">
            {(d.pt ?? []).length ? <DayLine rows={d.pt} clock={clock} /> : <Dim>لا أوقات للحصص.</Dim>}
          </Panel>

          <p className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--m-line)] pt-3 text-[11px] text-[var(--m-faint)]">
            <span>بوابة مكة الثانوية الرقمية · <span className="num font-semibold text-[var(--m-accent)]">makkahsec.com</span></span>
            <span>
            آخر تحديث <Clock t={d.at} /> · تتحدّث الشاشة كل دقيقة · أرقام إجمالية بلا أسماء طلاب</span>
          </p>
        </div>
      )}
    </div>
  );
}

/* ——— الحسابات ——— */
function model(d) {
  const rows = d.day?.rows ?? [];
  const s = summarize(rows, "official");
  const marked = rows.some((r) => Object.keys(r.periods).length);
  const fp = !!d.day?.fingerprint;
  const late = rows.filter((r) => r.isLate);
  const lateBy = {};
  late.forEach((r) => { const k = `${r.grade}/${r.class_no}`; lateBy[k] = (lateBy[k] ?? 0) + 1; });
  const lateTopE = Object.entries(lateBy).sort((a, b) => b[1] - a[1])[0];

  // الحضور حسب الفصل (من حُضّر فصله فقط)
  const cls = {};
  rows.forEach((r) => {
    if (r.official === "pending") return;
    const k = `${r.grade}-${r.class_no}`;
    const c = (cls[k] ??= { grade: r.grade, class_no: r.class_no, total: 0, present: 0 });
    c.total++; if (r.official === "present") c.present++;
  });
  const classes = Object.values(cls).map((c) => ({ ...c, pct: pctOf(c.present, c.total) }))
    .sort((a, b) => a.grade - b.grade || a.class_no - b.class_no);

  // التزام التحضير: الحصص المجدولة التي بدأت ورُصد تحضيرها
  const started = new Set((d.pt ?? []).filter((p) => p.kind === "period" && toMinutes(p.start_time) <= nowMin()).map((p) => p.period_no));
  const due = (d.day?.schedule ?? []).filter((r) => started.has(r.period_no));
  const doneIds = new Set(d.day?.markedIds ?? []);
  const done = due.filter((r) => doneIds.has(r.id)).length;

  // التحضير حسب الحصة: الفصول المجدولة في كل حصة، وكم حُضّر منها
  const byPeriod = (d.pt ?? []).filter((p) => p.kind === "period" && p.period_no != null)
    .sort((a, b) => a.period_no - b.period_no).map((p) => {
      const list = (d.day?.schedule ?? []).filter((r) => r.period_no === p.period_no);
      const n = list.filter((r) => doneIds.has(r.id)).length;
      return { no: p.period_no, total: list.length, done: n, pct: pctOf(n, list.length), started: started.has(p.period_no) };
    }).filter((p) => p.total);

  const series = d.trend.filter((t) => t.official_pct != null).map((t) => ({ d: t.attend_date, v: Number(t.official_pct) }));
  const pct = marked ? s.pct : null;
  if (pct != null) series.push({ d: d.date, v: pct, today: true });
  const past = d.trend.filter((t) => t.official_pct != null).map((t) => Number(t.official_pct));

  return {
    pct: pct == null ? null : Math.round(pct * 10) / 10, absent: marked ? s.absent : 0, excused: marked ? s.excused : 0,
    conflicts: rows.filter((r) => r.conflict).length, fp, late: late.length,
    lateTop: lateTopE ? `${GRADE_NAMES[lateTopE[0].split("/")[0]]?.replace(" الثانوي", "") ?? ""} / ${lateTopE[0].split("/")[1]} (${lateTopE[1]})` : null,
    mark: { total: due.length, done, pct: pctOf(done, due.length) },
    classes, series, byPeriod,
    yPct: past.length ? Math.round(past.at(-1) * 10) / 10 : null,
    avg: past.length ? Math.round((past.reduce((a, v) => a + v, 0) / past.length) * 10) / 10 : null,
    grades: [1, 2, 3].map((g) => ({ grade: g, pct: marked ? s.by_grade[g]?.pct ?? null : null })),
  };
}

/* ——— العناصر ——— */
// الساعة بنظام 12: الرقم ثم «ص/م» (بلا قلب الترتيب في السطر العربي)
function Clock({ t }) {
  const h = t.getHours(), m = String(t.getMinutes()).padStart(2, "0");
  return <><span className="num">{h % 12 || 12}:{m}</span> <span className="text-[0.6em]">{h < 12 ? "ص" : "م"}</span></>;
}

function SlotPill({ slot, clock }) {
  if (!slot) return <span className="rounded-pill bg-[var(--m-track)] px-3 py-1 text-xs text-[var(--m-sub)]">خارج وقت الدوام</span>;
  const s = toMinutes(slot.start_time), e = toMinutes(slot.end_time);
  const n = clock.getHours() * 60 + clock.getMinutes();
  const left = Math.max(0, e - n), prog = e > s ? Math.min(1, (n - s) / (e - s)) : 0;
  return (
    <div className="w-56">
      <p className="flex justify-between text-xs"><b>{slot.label}</b><span className="text-[var(--m-sub)]">باقٍ <span className="num">{left}</span> دقيقة</span></p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-[var(--m-track)]"><div className="h-full rounded-pill" style={{ width: `${prog * 100}%`, background: C.mint }} /></div>
    </div>
  );
}

function Big({ title, value, sub, color, icon, ring }) {
  return (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-[18px] border-[1.5px] border-[var(--m-line)] bg-[var(--m-card)] backdrop-blur-sm p-4">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <div className="flex items-center justify-between gap-2 text-sm text-[var(--m-sub)]">
        <span>{title}</span>
        {icon && <span style={{ color }}><Icon name={icon} className="h-5 w-5" /></span>}
      </div>
      <div className="mt-2 flex items-center gap-3">
        {ring != null && <span className="hidden sm:block"><Donut v={ring} color={color} /></span>}
        <p className="num text-3xl font-bold leading-none sm:text-5xl" style={{ color }}>{value}</p>
      </div>
      <p className="mt-2 text-xs leading-snug text-[var(--m-sub)]">{sub}</p>
    </div>
  );
}

function Donut({ v, color }) {
  const r = 16, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 40 40" className="h-12 w-12 shrink-0 -rotate-90">
      <circle cx="20" cy="20" r={r} fill="none" style={{ stroke: "var(--m-track)" }} strokeWidth="5" />
      <circle cx="20" cy="20" r={r} fill="none" style={{ stroke: color }} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
    </svg>
  );
}

function Panel({ title, icon, note, children, className = "" }) {
  return (
    <section className={`min-w-0 rounded-[18px] border-[1.5px] border-[var(--m-line)] bg-[var(--m-card)] backdrop-blur-sm p-4 ${className}`}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--m-sub)]">
        {icon && <Icon name={icon} className="h-4 w-4 text-[var(--m-faint)]" />}{title}
      </h2>
      {children}
      {note && <p className="mt-3 border-t border-[var(--m-line)] pt-2 text-[11px] leading-snug text-[var(--m-faint)]">{note}</p>}
    </section>
  );
}
const Dim = ({ children }) => <p className="py-6 text-center text-sm text-[var(--m-faint)]">{children}</p>;

function Mini({ rows, small }) {
  return (
    <div className={small ? "space-y-1.5" : "space-y-2"}>
      {rows.map(([l, v, c]) => (
        <div key={l} className="flex items-baseline justify-between gap-2">
          <span className={`${small ? "text-[13px]" : "text-sm"} text-[var(--m-sub)]`}>{l}</span>
          <span className={`num ${small ? "text-xl" : "text-2xl"} font-bold`} style={{ color: c ?? "var(--m-text)" }}>{v ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

/* أعمدة الفصول: كل صف دراسي مجموعة، ولون العمود بنسبة حضوره */
function ClassBars({ rows }) {
  const groups = [1, 2, 3].map((g) => rows.filter((r) => r.grade === g)).filter((x) => x.length);
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3 overflow-hidden">
        {groups.map((list) => (
          <div key={list[0].grade} className="min-w-0 shrink-0" style={{ flexGrow: list.length, flexBasis: 0 }}>
            <div className="flex h-32 items-end gap-1">
              {list.map((r) => (
                <div key={r.class_no} className="flex min-w-0 max-w-[3.5rem] flex-1 flex-col items-center gap-1" title={`فصل ${r.class_no}: ${r.pct}%`}>
                  <span className="num text-[10px] text-[var(--m-sub)]">{Math.round(r.pct)}</span>
                  <div className="w-full rounded-t-[4px]" style={{ height: `${Math.max(4, ((r.pct - 50) / 50) * 96)}px`, background: toneOf(r.pct) }} />
                  <span className="num text-[10px] text-[var(--m-faint)]">{r.class_no}</span>
                </div>
              ))}
            </div>
            <p className="mt-1 border-t border-[var(--m-line)] pt-1 text-center text-[11px] text-[var(--m-sub)]">{GRADE_NAMES[list[0].grade]}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-[11px] text-[var(--m-sub)]">
        {[[C.ok, "95% فأكثر"], [C.warn, "90–95%"], [C.bad, "أقل من 90%"]].map(([c, t]) => (
          <span key={t} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />{t}</span>))}
      </div>
    </div>
  );
}

/* التحضير حسب الحصة: عمود لكل حصة بنسبة الفصول المحضَّرة؛ الحصة التي لم تبدأ باهتة */
function PeriodBars({ rows, mark }) {
  return (
    <div>
    <p className="mb-2 flex items-baseline justify-between text-xs text-[var(--m-sub)]">
      <span>نسبة الرصد حتى الآن</span>
      <span><b className="num text-lg" style={{ color: toneOf(mark.pct) }}>{mark.total ? `${Math.round(mark.pct)}%` : "—"}</b>
        {mark.total > 0 && <span className="num"> · {mark.done} من {mark.total}</span>}</span>
    </p>
    <div className="flex h-36 items-end justify-between gap-1.5">
      {rows.map((p) => (
        <div key={p.no} className="flex flex-1 flex-col items-center gap-1" title={`الحصة ${p.no}: ${p.done} من ${p.total}`}>
          <span className="num text-[11px] font-bold" style={{ color: p.started ? toneOf(p.pct === 100 ? 100 : p.pct >= 90 ? 92 : 50) : "var(--m-faint)" }}>{p.started ? `${Math.round(p.pct)}%` : "—"}</span>
          <span className="num text-[9.5px] text-[var(--m-faint)]">{p.started ? `${p.done}/${p.total}` : ""}</span>
          <div className="flex h-24 w-full max-w-[2.5rem] items-end overflow-hidden rounded-t-[4px] bg-[var(--m-track)]">
            {p.started && <div className="w-full" style={{ height: `${Math.max(4, p.pct)}%`, background: toneOf(p.pct === 100 ? 100 : p.pct >= 90 ? 92 : 50) }} />}
          </div>
          <span className="text-[11px] text-[var(--m-sub)]">ح {p.no}</span>
        </div>
      ))}
    </div>
    </div>
  );
}

// اسم الفاصل في الخط الزمني بكلمته الأولى (الاصطفاف الصباحي ← الاصطفاف) ليتسع مربعه
const shortLabel = (l) => String(l ?? "").trim().split(/\s+/)[0];

// أسماء الإشراف بلا تكرار، بترتيبها الأبجدي
const uniqNames = (rows) => [...new Set(rows.map((r) => r.person_name?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));

/* الإشراف اليومي: المشرفون المتابعون أعلى البطاقة بلون مميز، ثم كل المعلمين المشرفين بلا حد للعدد */
function SupervisionList({ sup, teachers }) {
  return (
    <div className="space-y-3">
      {sup.length > 0 && (
        <div className="rounded-sm2 px-3 py-2.5" style={{ background: "var(--m-track)", borderInlineStart: "3px solid var(--m-gold)" }}>
          <p className="mb-1.5 text-[11px] font-semibold" style={{ color: "var(--m-gold)" }}>{sup.length > 1 ? "المشرفون المتابعون" : "المشرف المتابع"}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {sup.map((n) => <span key={n} className="text-base font-bold" style={{ color: "var(--m-gold)" }}>{n}</span>)}
          </div>
        </div>
      )}
      {teachers.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-baseline justify-between text-[11px] text-[var(--m-sub)]">
            <span>المعلمون المشرفون</span><span className="num">{teachers.length}</span>
          </p>
          {/* عمودان وكل اسم في سطر واحد (كانت الأسماء الرباعية تنكسر في ثلاثة أعمدة) */}
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
            {teachers.map((n) => (
              <li key={n} className="flex min-w-0 items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: C.info }} />
                <span className="min-w-0 truncate whitespace-nowrap leading-snug" title={n}>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* المناوبة: مناوبو اليوم من جدول المناوبة */
function DutyList({ names }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {names.map((n) => (
        <li key={n} className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: C.mint }} />
          <span className="min-w-0 flex-1 leading-snug">{n}</span>
        </li>
      ))}
    </ul>
  );
}

/* الخط الزمني لليوم: الحصص والفسح بعرض مدتها، والجاري مضيء، والماضي خافت */
function DayLine({ rows, clock }) {
  const list = [...rows].filter((r) => toMinutes(r.start_time) != null && toMinutes(r.end_time) != null)
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
  if (!list.length) return <Dim>لا أوقات للحصص.</Dim>;
  const s0 = toMinutes(list[0].start_time), s1 = toMinutes(list.at(-1).end_time);
  const now = clock.getHours() * 60 + clock.getMinutes();
  const fmt = (t) => { const v = toMinutes(t); const h = Math.floor(v / 60); return `${h % 12 || 12}:${String(v % 60).padStart(2, "0")}`; };
  // الخط الذهبي داخل الفترة الجارية بنسبة ما مضى منها: عرض المربعات لا يتناسب مع المدة تمامًا
  // (للفواصل عرض أدنى، وبينها مسافات)، فلا يصح حسابه من اليوم كله. وبين فترتين يقف عند بداية التالية.
  const at = now >= s0 && now <= s1
    ? list.findIndex((r) => now <= toMinutes(r.end_time)) : -1;
  const frac = at < 0 ? 0 : Math.min(1, Math.max(0,
    (now - toMinutes(list[at].start_time)) / Math.max(1, toMinutes(list[at].end_time) - toMinutes(list[at].start_time))));
  return (
    <div className="space-y-3 pt-2">
      <div className="flex h-12 gap-[3px]">
        {list.map((r, i) => {
          const a = toMinutes(r.start_time), b = toMinutes(r.end_time);
          const cur = now >= a && now <= b, past = now > b, per = r.kind === "period";
          return (
            <div key={i} className="relative min-w-0" style={{ flexGrow: b - a, flexBasis: 0, minWidth: per ? 0 : "3.6rem" }}>
              <div className="flex h-full flex-col items-center justify-center overflow-hidden rounded-[6px] text-[11px] font-semibold"
                style={{ background: cur ? "var(--m-accent)" : per ? "var(--m-track)" : "transparent",
                  border: per ? "none" : "1.5px dashed var(--m-line)", color: cur ? "var(--m-on)" : "var(--m-sub)", opacity: past && !cur ? 0.5 : 1 }}
                title={`${r.label ?? ""} ${fmt(r.start_time)}–${fmt(r.end_time)}`}>
                <span className="block w-full truncate px-0.5 text-center">{per ? r.period_no : shortLabel(r.label)}</span>
              </div>
              {i === at && <span className="absolute -top-1.5 bottom-[-6px] z-10 w-[2px] rounded-full"
                                 style={{ right: `calc(${frac * 100}% - 1px)`, background: "var(--m-gold)" }} />}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-[var(--m-sub)]">
        <span>البداية <span className="num">{fmt(list[0].start_time)}</span></span>
        <span>{now < s0 ? "لم يبدأ اليوم الدراسي" : now > s1 ? "انتهى اليوم الدراسي" : "الخط الذهبي: الآن"}</span>
        <span>النهاية <span className="num">{fmt(list.at(-1).end_time)}</span></span>
      </div>
    </div>
  );
}

/* القادم: فعاليات الأسبوع واختباراته، والعدّ للإجازة القادمة والاختبارات النهائية */
function Upcoming({ d }) {
  const h = nextHoliday();
  const exam = Math.ceil((EXAM_DATE.getTime() - Date.now()) / 864e5);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {h && <div className="rounded-sm2 bg-[var(--m-track)] px-2 py-1.5 text-center">
          <p className="num text-xl font-bold" style={{ color: "var(--m-accent)" }}>{h.days}</p>
          <p className="truncate text-[10px] text-[var(--m-sub)]">يومًا لـ{h.name}</p></div>}
        {exam > 0 && <div className="rounded-sm2 bg-[var(--m-track)] px-2 py-1.5 text-center">
          <p className="num text-xl font-bold" style={{ color: "var(--m-gold)" }}>{exam}</p>
          <p className="text-[10px] text-[var(--m-sub)]">يومًا للاختبارات النهائية</p></div>}
      </div>
      <p className="text-xs text-[var(--m-sub)]">اختبارات الأسبوع القادم: <b className="num text-[var(--m-text)]">{d.nextQuizzes ?? 0}</b></p>
      {d.nextEvents.length ? d.nextEvents.slice(0, 3).map((e) => (
        <p key={e.title + e.event_date} className="truncate text-xs"><span className="num text-[var(--m-sub)]">{WEEKDAYS[new Date(e.event_date + "T12:00:00").getDay()]}</span> · {e.title}</p>
      )) : <p className="text-xs text-[var(--m-faint)]">لا فعاليات هذا الأسبوع.</p>}
    </div>
  );
}

/* منحنى الحضور: الأيام المعتمدة ثم اليوم */
function Trend({ points }) {
  const W = 300, H = 110, lo = Math.min(85, ...points.map((p) => p.v)), hi = 100;
  const x = (i) => (points.length === 1 ? W / 2 : (i * (W - 20)) / (points.length - 1) + 10);
  const y = (v) => H - 14 - ((v - lo) / (hi - lo)) * (H - 28);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" style={{ transform: "scaleX(-1)" }}>
      <path d={`${path} L${x(points.length - 1)},${H} L${x(0)},${H} Z`} style={{ fill: C.mint }} opacity=".14" />
      <path d={path} fill="none" style={{ stroke: C.mint }} strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => <circle key={p.d} cx={x(i)} cy={y(p.v)} r={p.today ? 4.5 : 2.5} style={{ fill: p.today ? "var(--m-text)" : toneOf(p.v) }} />)}
    </svg>
  );
}
