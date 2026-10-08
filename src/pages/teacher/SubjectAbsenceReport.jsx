// src/pages/teacher/SubjectAbsenceReport.jsx
// تقرير غياب الطلاب في مادة المعلم — يجمع في صفحة واحدة كل ما يخص الغياب في حصصه:
// ملخص، غياب اليوم، الطلاب الأكثر غيابًا والمتتابع منه، التوزيع حسب الفصل والحصة واليوم، والاتجاه الأسبوعي.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fetchAllPaged } from "../../lib/attendanceHelpers";
import { DAY_NAMES, GRADE_NAMES, todayISO } from "../../lib/schoolTime";
import { fmtDate, noEra } from "../../lib/dates";
import { printReport, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";
import Loader from "../../components/Loader.jsx";
import { countAr } from "../../lib/arabicCount.js";

const STATUS_LABEL = { present: "حاضر", absent: "غائب", late: "متأخر", excused: "مستأذن" };
const STATUS_CHIP = {
  absent:  "bg-absent/10 text-absent",
  late:    "bg-late/10 text-late",
  excused: "bg-excused/10 text-excused",
  present: "bg-present/10 text-present",
};

// حدود تلوين نسبة الغياب — للتنبيه البصري فقط
const RATE_HIGH = 20;
const RATE_MID = 10;
const STREAK_ALERT = 3;     // غياب متتابع في ثلاث حصص فأكثر

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const toISO = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
// بداية الأسبوع الدراسي (الأحد)
const weekStart = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return toISO(d);
};

function rateTone(rate) {
  if (rate >= RATE_HIGH) return "text-absent";
  if (rate >= RATE_MID) return "text-late";
  return "text-ink";
}

function Stat({ label, value, tone = "text-ink", hint }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`num mt-1 text-2xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-faint">{hint}</p>}
    </div>
  );
}

function Bars({ items, max, unit = "%" }) {
  // items: [{ label, value, sub }]
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-xs text-muted">{i.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-pill bg-canvas">
            <div className="h-full rounded-pill bg-absent/70" style={{ width: `${Math.min(100, (i.value / top) * 100)}%` }} />
          </div>
          <span className={`num w-24 shrink-0 text-xs font-semibold ${rateTone(unit === "%" ? i.value : 0)}`} dir="ltr">
            {i.value}{unit === "%" ? "%" : ""}{i.sub ? <span className="font-normal text-faint"> · {i.sub}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SubjectAbsenceReport() {
  const { session } = useSession();
  const [state, setState] = useState({ loading: true, me: null, sched: [], rows: [], year: "", yearLabel: "", term: 1, error: "" });
  const [subject, setSubject] = useState("all");
  const [classId, setClassId] = useState("all");
  const [preset, setPreset] = useState("term");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [openStudent, setOpenStudent] = useState(null);
  const today = todayISO();

  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid) return;
      try {
        const { data: st } = await supabase.from("settings")
          .select("key, value").in("key", ["active_year", "active_term", "active_year_label"]);
        const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
        const year = m.active_year ?? "";
        const term = Number(m.active_term ?? 1);
        const yearLabel = noEra(m.active_year_label) ?? year;

        const { data: me } = await supabase.from("teachers")
          .select("id, full_name, specialization").eq("user_id", uid).maybeSingle();
        if (!me) { setState({ loading: false, me: null, sched: [], rows: [], year, yearLabel, term, error: "" }); return; }

        const { data: sched } = await supabase.from("schedule")
          .select("id, day_of_week, period_no, class_id, classes(class_no, grade), subjects(name)")
          .eq("teacher_id", me.id).eq("academic_year", year).eq("term", term);
        const ids = (sched ?? []).map((s) => s.id);

        let rows = [];
        if (ids.length) {
          rows = await fetchAllPaged(() =>
            supabase.from("class_attendance")
              .select("id, student_id, schedule_id, attend_date, status, students(full_name)")
              .in("schedule_id", ids).eq("academic_year", year)
              .order("id", { ascending: true }));
        }
        setState({ loading: false, me, sched: sched ?? [], rows, year, yearLabel, term, error: "" });
      } catch (e) {
        setState((s) => ({ ...s, loading: false, error: e.message ?? String(e) }));
      }
    })();
  }, [session]);

  const { loading, me, sched, rows, yearLabel, term, error } = state;

  const schedById = useMemo(() => Object.fromEntries(sched.map((s) => [s.id, s])), [sched]);
  const subjects = useMemo(() => [...new Set(sched.map((s) => s.subjects?.name).filter(Boolean))], [sched]);
  const classes = useMemo(() => {
    const m = new Map();
    sched.forEach((s) => {
      if (subject !== "all" && s.subjects?.name !== subject) return;
      if (s.classes) m.set(s.class_id, s.classes);
    });
    return [...m.entries()].sort((a, b) => a[1].grade - b[1].grade || a[1].class_no - b[1].class_no);
  }, [sched, subject]);

  // حدود المدة المختارة
  const range = useMemo(() => {
    if (preset === "today") return [today, today];
    if (preset === "week") return [weekStart(today), today];
    if (preset === "month") return [`${today.slice(0, 8)}01`, today];
    if (preset === "custom") return [from || "0000-01-01", to || "9999-12-31"];
    return ["0000-01-01", "9999-12-31"];
  }, [preset, from, to, today]);

  const data = useMemo(() => {
    const list = rows.filter((r) => {
      const s = schedById[r.schedule_id];
      if (!s) return false;
      if (subject !== "all" && s.subjects?.name !== subject) return false;
      if (classId !== "all" && s.class_id !== classId) return false;
      return r.attend_date >= range[0] && r.attend_date <= range[1];
    });

    const tot = { present: 0, absent: 0, late: 0, excused: 0 };
    const sessions = new Set();
    const byStudent = new Map();
    const byClass = new Map();
    const byPeriod = new Map();
    const byDay = new Map();
    const byWeek = new Map();

    const bump = (map, key, status, init = {}) => {
      const o = map.get(key) ?? { present: 0, absent: 0, late: 0, excused: 0, ...init };
      o[status] += 1;
      map.set(key, o);
      return o;
    };

    list.forEach((r) => {
      const s = schedById[r.schedule_id];
      tot[r.status] = (tot[r.status] ?? 0) + 1;
      sessions.add(`${r.schedule_id}|${r.attend_date}`);
      const cls = s.classes ? `${s.classes.class_no}` : "—";
      const o = bump(byStudent, r.student_id, r.status, { name: r.students?.full_name ?? "—", classes: new Set(), events: [] });
      o.classes.add(`${GRADE_NAMES[s.classes?.grade] ?? ""} فصل ${cls}`.trim());
      o.events.push({ date: r.attend_date, period: s.period_no, status: r.status, cls });
      bump(byClass, s.class_id, r.status, { grade: s.classes?.grade, no: s.classes?.class_no });
      bump(byPeriod, s.period_no, r.status);
      bump(byDay, s.day_of_week, r.status);
      bump(byWeek, weekStart(r.attend_date), r.status);
    });

    // أطول سلسلة غياب متتابع لكل طالب (حصة بعد حصة في هذه المادة)
    byStudent.forEach((o) => {
      o.events.sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period);
      let cur = 0; let best = 0;
      o.events.forEach((e) => {
        if (e.status === "absent") { cur += 1; best = Math.max(best, cur); } else if (e.status !== "excused") cur = 0;
      });
      o.streak = best;
      o.total = o.present + o.absent + o.late + o.excused;
      o.rate = pct(o.absent, o.total);
    });

    const students = [...byStudent.entries()].map(([id, o]) => ({ id, ...o }))
      .sort((a, b) => b.absent - a.absent || b.rate - a.rate || a.name.localeCompare(b.name, "ar"));

    const todayAbsent = list.filter((r) => r.attend_date === today && (r.status === "absent" || r.status === "late"))
      .map((r) => ({ ...r, s: schedById[r.schedule_id] }))
      .sort((a, b) => a.s.period_no - b.s.period_no);

    const total = list.length;
    return { list, tot, total, sessions: sessions.size, students, byClass, byPeriod, byDay, byWeek, todayAbsent };
  }, [rows, schedById, subject, classId, range, today]);

  const rate = pct(data.tot.absent, data.total);
  const repeated = data.students.filter((s) => s.absent >= 1);
  const streakers = data.students.filter((s) => s.streak >= STREAK_ALERT);
  const visibleStudents = useMemo(() => {
    const t = q.trim();
    const base = t ? data.students.filter((s) => s.name.includes(t)) : repeated;
    return showAll || t ? base : base.slice(0, 15);
  }, [data.students, repeated, q, showAll]);

  const filterLabel = () => {
    const parts = [subject === "all" ? "كل المواد" : subject];
    if (classId !== "all") { const c = classes.find(([id]) => id === classId)?.[1]; if (c) parts.push(`فصل ${c.class_no}`); }
    const names = { term: "الفصل الدراسي كاملًا", today: "اليوم", week: "هذا الأسبوع", month: "هذا الشهر" };
    parts.push(preset === "custom" ? `من ${from || "البداية"} إلى ${to || "اليوم"}` : names[preset]);
    return parts.join(" · ");
  };

  const printIt = () => {
    printReport({
      title: `تقرير غياب الطلاب — ${me?.full_name ?? ""}`,
      subtitle: `${filterLabel()} · ${yearLabel} · الفصل الدراسي ${term}`,
      headers: ["#", "الطالب", "الفصل", "غياب", "تأخر", "استئذان", "الحصص المسجّلة", "نسبة الغياب", "أطول غياب متتابع"],
      rows: repeated.map((s, i) => [
        i + 1, s.name, [...s.classes].join("، "), s.absent, s.late, s.excused, s.total, `${s.rate}%`, s.streak,
      ]),
      note: `إجمالي الحصص المسجّلة ${data.sessions} · غياب ${data.tot.absent} · تأخر ${data.tot.late} · استئذان ${data.tot.excused} · نسبة الغياب ${rate}%`,
      landscape: true,
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      signatures: [
        { title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
      hideSignatureLine: true,
    });
  };

  if (loading) return <Loader />;

  if (error) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-absent">تعذّر تحميل التقرير</p>
        <p className="mt-1.5 text-sm text-muted">{error}</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">الحساب غير مرتبط بسجل معلم</p>
        <p className="mt-1.5 text-sm text-muted">راجع إدارة المدرسة.</p>
      </div>
    );
  }

  if (!sched.length) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">لا توجد حصص في جدولك لهذا الفصل</p>
        <p className="mt-1.5 text-sm text-muted">يظهر التقرير حين يُدرج جدولك ويبدأ تحضير الحصص.</p>
      </div>
    );
  }

  const chipBtn = (active) =>
    `rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors ${
      active ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`;

  const weekItems = [...data.byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
    .map(([w, o]) => ({ label: fmtDate(w).split(" - ")[1] ?? w, value: o.absent, sub: `${pct(o.absent, o.present + o.absent + o.late + o.excused)}%` }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">تقرير غياب طلاب مادتي</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            كل ما يتعلق بغياب الطلاب في حصصك للفصل الدراسي {term} · {yearLabel}.
          </p>
        </div>
        <button onClick={printIt} disabled={!data.total}
          className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
          طباعة التقرير — PDF
        </button>
      </div>

      {/* المرشّحات */}
      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {[["term", "الفصل كاملًا"], ["month", "هذا الشهر"], ["week", "هذا الأسبوع"], ["today", "اليوم"], ["custom", "مدة محددة"]].map(([k, l]) => (
            <button key={k} onClick={() => setPreset(k)} className={chipBtn(preset === k)}>{l}</button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2 text-muted">من
              <input type="date" className="field !w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="flex items-center gap-2 text-muted">إلى
              <input type="date" className="field !w-auto" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {subjects.length > 1 && (
            <select className="field !w-auto" value={subject} onChange={(e) => { setSubject(e.target.value); setClassId("all"); }}>
              <option value="all">كل موادي</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <select className="field !w-auto" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="all">كل فصولي</option>
            {classes.map(([id, c]) => (
              <option key={id} value={id}>{GRADE_NAMES[c.grade] ?? ""} · فصل {c.class_no}</option>
            ))}
          </select>
        </div>
      </section>

      {!data.total ? (
        <div className="card px-6 py-12 text-center">
          <p className="font-semibold text-ink">لا توجد حصص مسجّلة في هذه المدة</p>
          <p className="mt-1.5 text-sm text-muted">غيّر المدة أو الفصل، أو ابدأ بتحضير حصصك من «الحضور والغياب اليومي».</p>
        </div>
      ) : (
        <>
          {/* الملخص */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="حصص مسجّلة" value={data.sessions} />
            <Stat label="غياب" value={data.tot.absent} tone="text-absent" />
            <Stat label="تأخر" value={data.tot.late} tone="text-late" />
            <Stat label="استئذان" value={data.tot.excused} tone="text-excused" />
            <Stat label="نسبة الغياب" value={`${rate}%`} tone={rateTone(rate)} hint="غياب ÷ كل السجلات" />
            <Stat label="طلاب غابوا" value={repeated.length} hint={`من ${countAr(data.students.length, "student", { acc: true })}`} />
          </section>

          {/* غياب اليوم */}
          <section className="card p-4">
            <h2 className="text-sm font-bold text-ink">غياب وتأخر اليوم في حصصي</h2>
            {data.todayAbsent.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                {rows.some((r) => r.attend_date === today)
                  ? "لا غياب ولا تأخر في الحصص التي حضّرتها اليوم."
                  : "لم تُسجَّل حصصك لهذا اليوم بعد، أو لا تقع ضمن المدة المختارة."}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {data.todayAbsent.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="font-medium text-ink">{r.students?.full_name ?? "—"}</span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      الحصة {r.s.period_no} · فصل {r.s.classes?.class_no}
                      <span className={`chip ${STATUS_CHIP[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* تنبيهات */}
          {streakers.length > 0 && (
            <section className="rounded-card border border-absent/30 bg-absent/[.04] p-4">
              <h2 className="text-sm font-bold text-absent">غياب متتابع يحتاج متابعة</h2>
              <p className="mt-1 text-xs text-muted">
                طلاب غابوا عن {STREAK_ALERT} حصص متتالية فأكثر في مادتك:
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {streakers.map((s) => (
                  <li key={s.id} className="chip bg-absent/10 text-absent">{s.name} · {s.streak} حصص</li>
                ))}
              </ul>
            </section>
          )}

          {/* الطلاب */}
          <section className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-ink">الطلاب الأكثر غيابًا</h2>
              <input className="field !w-52" placeholder="بحث باسم الطالب" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <p className="mt-1 text-[11px] text-faint">
              النسبة من {RATE_MID}% بلون التنبيه، ومن {RATE_HIGH}% بالأحمر. اضغط على الطالب لعرض تواريخ غيابه.
            </p>
            {visibleStudents.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{q ? "لا نتائج لهذا الاسم." : "لا غياب مسجّل في هذه المدة."}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-right text-xs text-muted">
                      <th className="py-2 pr-2 font-medium">الطالب</th>
                      <th className="px-2 font-medium">الفصل</th>
                      <th className="px-2 text-center font-medium">غياب</th>
                      <th className="px-2 text-center font-medium">تأخر</th>
                      <th className="px-2 text-center font-medium">استئذان</th>
                      <th className="px-2 text-center font-medium">الحصص</th>
                      <th className="px-2 text-center font-medium">النسبة</th>
                      <th className="px-2 text-center font-medium">أطول متتابع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleStudents.map((s) => (
                      <StudentRow key={s.id} s={s} open={openStudent === s.id}
                        toggle={() => setOpenStudent(openStudent === s.id ? null : s.id)} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!q && repeated.length > 15 && (
              <button onClick={() => setShowAll((v) => !v)} className="mt-3 text-xs font-medium text-mint-deep hover:underline">
                {showAll ? "عرض الأكثر غيابًا فقط" : `عرض كل الطلاب الذين غابوا (${repeated.length})`}
              </button>
            )}
          </section>

          {/* التوزيع */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="card p-4">
              <h2 className="mb-3 text-sm font-bold text-ink">نسبة الغياب حسب الفصل</h2>
              <Bars unit="%"
                items={[...data.byClass.values()].sort((a, b) => a.grade - b.grade || a.no - b.no).map((o) => ({
                  label: `فصل ${o.no}`, value: pct(o.absent, o.present + o.absent + o.late + o.excused), sub: `${o.absent} غياب`,
                }))} max={Math.max(30, ...[...data.byClass.values()].map((o) => pct(o.absent, o.present + o.absent + o.late + o.excused)))} />
            </section>
            <section className="card p-4">
              <h2 className="mb-3 text-sm font-bold text-ink">نسبة الغياب حسب الحصة</h2>
              <Bars unit="%"
                items={[...data.byPeriod.entries()].sort((a, b) => a[0] - b[0]).map(([p, o]) => ({
                  label: `الحصة ${p}`, value: pct(o.absent, o.present + o.absent + o.late + o.excused), sub: `${o.absent} غياب`,
                }))} max={Math.max(30, ...[...data.byPeriod.values()].map((o) => pct(o.absent, o.present + o.absent + o.late + o.excused)))} />
            </section>
            <section className="card p-4">
              <h2 className="mb-3 text-sm font-bold text-ink">نسبة الغياب حسب اليوم</h2>
              <Bars unit="%"
                items={[...data.byDay.entries()].sort((a, b) => a[0] - b[0]).map(([d, o]) => ({
                  label: DAY_NAMES[d] ?? d, value: pct(o.absent, o.present + o.absent + o.late + o.excused), sub: `${o.absent} غياب`,
                }))} max={Math.max(30, ...[...data.byDay.values()].map((o) => pct(o.absent, o.present + o.absent + o.late + o.excused)))} />
            </section>
            <section className="card p-4">
              <h2 className="mb-3 text-sm font-bold text-ink">الاتجاه الأسبوعي (عدد الغياب)</h2>
              <Bars unit=" " items={weekItems} />
              <p className="mt-2 text-[11px] text-faint">آخر ١٢ أسبوعًا مسجّلًا؛ التاريخ هو بداية الأسبوع (الأحد).</p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function StudentRow({ s, open, toggle }) {
  return (
    <>
      <tr onClick={toggle} className="cursor-pointer border-b border-line/60 hover:bg-canvas">
        <td className="py-2 pr-2 font-medium text-ink">{s.name}</td>
        <td className="px-2 text-xs text-muted">{[...s.classes].join("، ")}</td>
        <td className="num px-2 text-center font-semibold text-absent">{s.absent}</td>
        <td className="num px-2 text-center text-late">{s.late}</td>
        <td className="num px-2 text-center text-excused">{s.excused}</td>
        <td className="num px-2 text-center text-muted">{s.total}</td>
        <td className={`num px-2 text-center font-semibold ${rateTone(s.rate)}`} dir="ltr">{s.rate}%</td>
        <td className="px-2 text-center">
          <span className={`num ${s.streak >= STREAK_ALERT ? "chip bg-absent/10 text-absent" : "text-muted"}`}>{s.streak}</span>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-line/60 bg-canvas/60">
          <td colSpan={8} className="px-3 py-3">
            <div className="flex max-w-[19rem] flex-wrap gap-2 sm:max-w-none">
              {s.events.filter((e) => e.status !== "present").map((e, i) => (
                <span key={i} className={`chip ${STATUS_CHIP[e.status]}`}>
                  {fmtDate(e.date).split(" - ")[1]} · الحصة {e.period} · {STATUS_LABEL[e.status]}
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
