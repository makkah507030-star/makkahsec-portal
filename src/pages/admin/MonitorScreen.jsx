// src/pages/admin/MonitorScreen.jsx
/* =====================================================================
   شاشة المتابعة — الوضع اليومي للمدرسة في شاشة كاملة، للمدير والوكيلين والدعم الفني.
   أرقام كبيرة تُقرأ من بعيد، ورسوم للحضور حسب الفصول واتجاهه، وما يجري الآن.
   تُعرض أمام الضيوف: أرقام ورسوم فقط، بلا أي اسم طالب. تتحدّث كل دقيقة.
   البيانات من الجداول القائمة (loadDay وغيرها)، فلا تحتاج SQL.
   ===================================================================== */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { todayISO, todayOff, GRADE_NAMES } from "../../lib/schoolTime";
import { fmtHijri, fmtGreg } from "../../lib/dates";
import { loadPeriodTimes, toMinutes, currentSlot } from "../../lib/periodTimes";
import { loadDay, summarize } from "../../lib/officialAttendance";
import { OPEN_STATUSES } from "../../lib/referrals.js";
import { Icon } from "../../components/Layout.jsx";
import logoIcon from "../../assets/icon-mint.png";

// ألوان الحالة من هوية البوابة (index.css)، وتتبدّل قيمها بالوضع الفاتح أو الداكن (THEMES)
const C = { ok: "var(--m-ok)", warn: "var(--m-warn)", bad: "var(--m-bad)", info: "var(--m-info)", mint: "var(--m-accent)", dim: "var(--m-faint)" };
const THEMES = {
  light: { "--m-bg": "#F4F4F4", "--m-card": "#FFFFFF", "--m-line": "#DCDFDD", "--m-track": "#EDF0EE", "--m-text": "#101010",
           "--m-sub": "#6B6B6B", "--m-faint": "#A9A9A9", "--m-ok": "#4E7D66", "--m-warn": "#9A7B22", "--m-bad": "#A23B3B",
           "--m-info": "#3F6B99", "--m-accent": "#3E6350", "--m-head": "#3E6350" },
  dark:  { "--m-bg": "#111513", "--m-card": "#1B201D", "--m-line": "#3A433E", "--m-track": "#2A322E", "--m-text": "#E9EEEB",
           "--m-sub": "#A3ADA7", "--m-faint": "#737E78", "--m-ok": "#4E8C6C", "--m-warn": "#A8872D", "--m-bad": "#BE5050",
           "--m-info": "#4678AA", "--m-accent": "#89D7AD", "--m-head": "#89D7AD" },
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
    const dow = new Date(date + "T12:00:00").getDay();
    const start = new Date(date + "T00:00:00").toISOString();
    (async () => {
      const [day, pt, trend, sub, perms, refsToday, refsOpen, behavior, duty, supervision, events, quizzes, lab, notes] = await Promise.all([
        todayOff() ? null : loadDay(date).catch(() => null),
        loadPeriodTimes().then((r) => r.rows).catch(() => []),
        supabase.from("official_attendance_days").select("attend_date, official_pct, late_count")
          .lt("attend_date", date).order("attend_date", { ascending: false }).limit(10),
        countOf(supabase.from("substitute_periods").select("id", { count: "exact", head: true }).eq("attend_date", date)),
        supabase.from("permission_requests").select("id, permission_request_students(student_id)").eq("request_date", date),
        countOf(supabase.from("student_referrals").select("id", { count: "exact", head: true }).eq("referral_date", date)),
        countOf(supabase.from("student_referrals").select("id", { count: "exact", head: true }).in("status", OPEN_STATUSES)),
        countOf(supabase.from("behavior_forms").select("id", { count: "exact", head: true }).gte("created_at", start)),
        supabase.from("duty_roster").select("name_a, name_b").eq("duty_date", date),
        supabase.from("supervision_duty").select("person_name, kind").eq("day_of_week", dow),
        supabase.from("school_events").select("title, category, event_date, end_date, start_time, venue")
          .lte("event_date", date).neq("stage", "draft").is("cancelled_at", null).order("event_date", { ascending: false }).limit(30),
        countOf(supabase.from("quizzes").select("id", { count: "exact", head: true }).eq("exam_date", date).neq("status", "draft")),
        countOf(supabase.from("lab_bookings").select("id", { count: "exact", head: true }).eq("booking_date", date)),
        countOf(supabase.from("notifications").select("id", { count: "exact", head: true }).gte("created_at", start)),
      ]);
      if (!live) return;
      const permStudents = new Set((perms.data ?? []).flatMap((p) => (p.permission_request_students ?? []).map((x) => x.student_id)));
      setD({
        date, day, pt, trend: [...(trend.data ?? [])].reverse(), sub,
        perms: { requests: (perms.data ?? []).length, students: permStudents.size },
        refsToday, refsOpen, behavior,
        duty: [...(duty.data ?? []).flatMap((r) => [r.name_a, r.name_b]), ...(supervision.data ?? []).map((r) => r.person_name)].filter(Boolean),
        events: (events.data ?? []).filter((e) => e.event_date === date || (e.end_date && e.end_date >= date)),
        quizzes, lab, notes, at: new Date(),
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
    <div dir="rtl" className={`${full ? "fixed inset-0 z-[70] overflow-auto" : "-mx-4 -mt-5 sm:-mx-6"} min-h-full bg-[var(--m-bg)] p-4 text-[var(--m-text)] sm:p-6`} style={THEMES[theme]}>
      {/* الترويسة */}
      <header className="flex flex-wrap items-center gap-4 border-b border-[var(--m-line)] pb-4">
        <img src={logoIcon} alt="" className="h-12 w-12 rounded-card bg-[var(--m-track)] p-1.5" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-[var(--m-head)] sm:text-2xl">مدرسة مكة الثانوية</h1>
          <p className="text-sm text-[var(--m-sub)]">شاشة المتابعة اليومية</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold tracking-wide sm:text-4xl"><Clock t={clock} /></p>
          <p className="text-xs text-[var(--m-sub)]">{WEEKDAYS[clock.getDay()]} · <span className="num">{fmtHijri(clock)}</span> هـ · <span className="num">{fmtGreg(clock)}</span> م</p>
        </div>
        <div className="flex flex-col items-end gap-2">
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

      {!d ? <p className="py-24 text-center text-[var(--m-sub)]">جارٍ تحميل بيانات اليوم…</p> : (
        <div className="mt-5 space-y-5">
          {off && <p className="rounded-card bg-[var(--m-track)] px-4 py-3 text-center text-[var(--m-sub)]">{off.title} — {off.body}</p>}

          {/* الصف الأول: الأرقام الكبرى */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Big title="نسبة الحضور اليوم" value={m.pct == null ? "—" : `${m.pct}%`} color={toneOf(m.pct)} ring={m.pct}
              sub={m.yPct != null ? `أمس ${m.yPct}% · متوسط الأيام العشرة ${m.avg}%` : "—"} />
            <Big title="الغياب" value={m.absent} color={m.absent ? C.bad : C.ok} icon="userX"
              sub={`بلا عذر · بعذر ${m.excused}${m.conflicts ? ` · بصم ولم يحضر ${m.conflicts}` : ""}`} />
            <Big title="التأخر الصباحي" value={m.fp ? m.late : "—"} color={m.late > 20 ? C.bad : m.late ? C.warn : C.ok} icon="clock"
              sub={m.fp ? (m.lateTop ? `أكثرها: ${m.lateTop}` : "لا تأخر") : "البصمة مقفلة"} />
            <Big title="التحضير في الحصص" value={m.mark.total ? `${m.mark.pct}%` : "—"} color={toneOf(m.mark.pct)} icon="clipboard"
              sub={m.mark.total ? `${m.mark.done} من ${m.mark.total} حصة حتى الآن` : "لم تبدأ الحصص"} />
            <Big title="حصص الانتظار" value={d.sub ?? "—"} color={C.info} icon="swap" sub="حصة مغطاة اليوم" />
            <Big title="الاستئذان" value={d.perms.students} color={d.perms.students ? C.warn : C.ok} icon="ticket"
              sub={`طالبًا في ${d.perms.requests} طلب`} />
          </div>

          {/* الصف الثاني: الرسوم */}
          <div className="grid gap-3 xl:grid-cols-3">
            <Panel title="الحضور حسب الفصول" className="xl:col-span-2">
              {m.classes.length ? <ClassBars rows={m.classes} /> : <Dim>لا تحضير بعد اليوم.</Dim>}
            </Panel>
            <Panel title="اتجاه الحضور: آخر الأيام الدراسية">
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

          {/* الصف الثالث: ما يجري الآن */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Panel title="الانضباط" icon="flag">
              <Mini rows={[["إحالات اليوم", d.refsToday], ["إحالات قيد المتابعة", d.refsOpen, d.refsOpen ? C.warn : C.ok], ["نماذج سلوك اليوم", d.behavior]]} />
            </Panel>
            <Panel title="المناوبة والإشراف" icon="whistle">
              {d.duty.length ? <ul className="space-y-1.5 text-sm">{[...new Set(d.duty)].slice(0, 6).map((n) => <li key={n} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full" style={{ background: C.mint }} />{n}</li>)}</ul>
                : <Dim>لا مناوبين مسجّلين اليوم.</Dim>}
            </Panel>
            <Panel title="اليوم في المدرسة" icon="calendar">
              <Mini rows={[["اختبارات مجدولة", d.quizzes], ["حجوزات المعمل", d.lab], ["فعاليات جارية", d.events.length]]} />
              {d.events.slice(0, 2).map((e) => <p key={e.title} className="mt-2 truncate text-xs text-[var(--m-sub)]">• {e.title}</p>)}
            </Panel>
            <Panel title="التواصل" icon="bell">
              <Mini rows={[["إشعارات اليوم", d.notes]]} />
            </Panel>
          </div>

          <p className="text-center text-[11px] text-[var(--m-faint)]">
            آخر تحديث <Clock t={d.at} /> · تتحدّث الشاشة كل دقيقة · أرقام إجمالية بلا أسماء طلاب
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

  const series = d.trend.filter((t) => t.official_pct != null).map((t) => ({ d: t.attend_date, v: Number(t.official_pct) }));
  const pct = marked ? s.pct : null;
  if (pct != null) series.push({ d: d.date, v: pct, today: true });
  const past = d.trend.filter((t) => t.official_pct != null).map((t) => Number(t.official_pct));

  return {
    pct: pct == null ? null : Math.round(pct * 10) / 10, absent: marked ? s.absent : 0, excused: marked ? s.excused : 0,
    conflicts: rows.filter((r) => r.conflict).length, fp, late: late.length,
    lateTop: lateTopE ? `${GRADE_NAMES[lateTopE[0].split("/")[0]]?.replace(" الثانوي", "") ?? ""} / ${lateTopE[0].split("/")[1]} (${lateTopE[1]})` : null,
    mark: { total: due.length, done, pct: pctOf(done, due.length) },
    classes, series,
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
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-card border border-[var(--m-line)] bg-[var(--m-card)] shadow-card p-4">
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

function Panel({ title, icon, children, className = "" }) {
  return (
    <section className={`min-w-0 rounded-card border border-[var(--m-line)] bg-[var(--m-card)] shadow-card p-4 ${className}`}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--m-sub)]">
        {icon && <Icon name={icon} className="h-4 w-4 text-[var(--m-faint)]" />}{title}
      </h2>
      {children}
    </section>
  );
}
const Dim = ({ children }) => <p className="py-6 text-center text-sm text-[var(--m-faint)]">{children}</p>;

function Mini({ rows }) {
  return (
    <div className="space-y-2">
      {rows.map(([l, v, c]) => (
        <div key={l} className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-[var(--m-sub)]">{l}</span>
          <span className="num text-2xl font-bold" style={{ color: c ?? "var(--m-text)" }}>{v ?? "—"}</span>
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
      <div className="flex items-end gap-4 overflow-x-auto pb-1">
        {groups.map((list) => (
          <div key={list[0].grade} className="min-w-0 shrink-0" style={{ flexGrow: list.length, flexBasis: 0, minWidth: `${list.length * 2.2}rem` }}>
            <div className="flex h-40 items-end gap-1.5">
              {list.map((r) => (
                <div key={r.class_no} className="flex min-w-[1.75rem] max-w-[4rem] flex-1 flex-col items-center gap-1" title={`فصل ${r.class_no}: ${r.pct}%`}>
                  <span className="num text-[10px] text-[var(--m-sub)]">{Math.round(r.pct)}</span>
                  <div className="w-full rounded-t-[4px]" style={{ height: `${Math.max(4, ((r.pct - 50) / 50) * 120)}px`, background: toneOf(r.pct) }} />
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
