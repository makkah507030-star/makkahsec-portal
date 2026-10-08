// التقارير المفصلة: الحضور والمتابعة بالفصل، وبالحصة، وبالطالب
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { todayISO, PERIODS_PER_DAY, GRADE_NAMES, STATUS } from "../../lib/schoolTime";
import { fmtDate, fmtTime12 } from "../../lib/dates";
import { printReport, exportStyledExcel } from "../../lib/exportUtils";
import { fetchAllPaged } from "../../lib/attendanceHelpers";
import { loadRangeStart, OFFICIAL_LABEL } from "../../lib/officialAttendance";
import {
  SIGNS, logos, Pill, Fig, DateInput, ExportBar, GradePills, Note, Loading, Empty, useDay,
  weekdayOf, daysWord,
} from "./shared.jsx";
import { countAr } from "../../lib/arabicCount.js";

const VIEWS = [
  { key: "class", label: "بالفصل" },
  { key: "period", label: "بالحصة" },
  { key: "student", label: "بالطالب" },
];

export default function DetailedReports() {
  const [view, setView] = useState("class");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {VIEWS.map((v) => <Pill key={v.key} on={view === v.key} onClick={() => setView(v.key)}>{v.label}</Pill>)}
      </div>
      {view === "class" && <ByClass />}
      {view === "period" && <ByPeriod />}
      {view === "student" && <ByStudent />}
    </div>
  );
}

/* ============================ أدوات مشتركة ============================ */

// رمز الحالة في خلية الحصة: مختصر للطباعة، وملوّن على الشاشة
const MARK = { present: "✓", absent: "غ", late: "ت", excused: "س" };
const CELL = {
  present: "text-present",
  absent: "bg-absent/10 text-absent font-bold",
  late: "bg-warning-light text-warning font-bold",
  excused: "bg-[#E9E7FB] text-[#544CC0] font-bold",
};
const LEGEND = "✓ حاضر · غ غائب · ت متأخر · س مستأذن · — لم تُرصد";
const stLabel = (s) => STATUS[s]?.label ?? "—";

// رمز الفصل كما في المدرسة: ثلاثة أرقام (101، 205)
const classCode = (grade, no) => (Number(no) >= 100 ? Number(no) : (Number(grade) || 0) * 100 + (Number(no) || 0));
const classKey = (r) => `${r.grade}-${r.class_no}`;

// حصص اليوم: من جدوله، مع أي حصة ظهرت في السجلات
function dayPeriods(date, rows) {
  const dow = new Date(`${date}T12:00:00`).getDay() + 1;
  const set = new Set(Array.from({ length: PERIODS_PER_DAY[dow] ?? 7 }, (_, i) => i + 1));
  (rows ?? []).forEach((r) => Object.keys(r.periods ?? {}).forEach((p) => set.add(Number(p))));
  return [...set].sort((a, b) => a - b);
}

/** ملاحظة المتابعة لطالب في يومه — ما يستحق تدخل الوكيل */
function followNote(r, fp) {
  const notes = [];
  if (fp && r.conflict) notes.push("بصم ولم يحضر");
  // غاب بعد حضور: حضر حصة ثم غاب عن حصة لاحقة
  const ps = Object.entries(r.periods ?? {}).map(([p, s]) => [Number(p), s]).sort((a, b) => a[0] - b[0]);
  const firstIn = ps.find(([, s]) => s === "present" || s === "late");
  if (firstIn) {
    const gone = ps.find(([p, s]) => p > firstIn[0] && s === "absent");
    if (gone) notes.push(`غاب من الحصة ${gone[0]} بعد حضوره`);
  }
  if (fp && r.isLate) notes.push(`تأخر صباحي ${r.lateMinutes} د`);
  if (fp && r.noPunch) notes.push("حضر بلا بصمة");
  return notes.join(" · ");
}

function scheduleMap(schedule) {
  const m = new Map();
  (schedule ?? []).forEach((s) => {
    if (!s.classes) return;
    m.set(`${s.classes.grade}-${s.classes.class_no}-${s.period_no}`, {
      subject: s.subjects?.name ?? "", teacher: s.teachers?.full_name ?? "",
    });
  });
  return m;
}

function Table({ head, children }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead className="bg-mint-tint/60 text-xs text-mint-deep">
          <tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap px-2.5 py-2 text-center font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

function ClassSelect({ classes, value, onChange, allLabel = "كل الفصول" }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      الفصل
      <select value={value} onChange={(e) => onChange(e.target.value)}
              className="rounded-sm2 border border-line bg-white px-3 py-2 text-sm text-ink">
        <option value="">{allLabel}</option>
        {classes.map((c) => <option key={c.key} value={c.key}>{c.code} — {GRADE_NAMES[c.grade] ?? ""}</option>)}
      </select>
    </label>
  );
}

function useClasses(rows, grade) {
  return useMemo(() => {
    const m = new Map();
    (rows ?? []).forEach((r) => {
      if (grade && r.grade !== grade) return;
      if (!m.has(classKey(r))) m.set(classKey(r), { key: classKey(r), grade: r.grade, class_no: r.class_no, code: classCode(r.grade, r.class_no) });
    });
    return [...m.values()].sort((a, b) => a.code - b.code);
  }, [rows, grade]);
}

/* ============================ 1) بالفصل ============================ */

function ByClass() {
  const [date, setDate] = useState(todayISO());
  const [grade, setGrade] = useState(0);
  const [cls, setCls] = useState("");
  const { live, error } = useDay(date);
  const fp = !!live?.fingerprint;
  const classes = useClasses(live?.rows, grade);
  const periods = useMemo(() => dayPeriods(date, live?.rows), [date, live]);
  const sched = useMemo(() => scheduleMap(live?.schedule), [live]);
  useEffect(() => { if (cls && !classes.some((c) => c.key === cls)) setCls(""); }, [classes, cls]);

  const picked = cls ? classes.filter((c) => c.key === cls) : classes;
  const studentsOf = (c) => (live?.rows ?? [])
    .filter((r) => classKey(r) === c.key)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));

  // أرقام الفصل: حضور رسمي، وغياب كل حصة
  const statsOf = (list) => {
    const s = { total: list.length, present: 0, absent: 0, excused: 0, pending: 0, notes: 0 };
    list.forEach((r) => { s[r.official] = (s[r.official] ?? 0) + 1; if (followNote(r, fp)) s.notes++; });
    s.perPeriod = Object.fromEntries(periods.map((p) => [p, list.filter((r) => r.periods?.[p] === "absent").length]));
    return s;
  };

  const head = ["م", "اسم الطالب", ...periods.map((p) => `ح${p}`), "الحالة الرسمية", ...(fp ? ["البصمة"] : []), "المتابعة"];
  const rowCells = (r, i) => [
    i + 1, r.full_name,
    ...periods.map((p) => { const s = r.periods?.[p]; return s ? { text: MARK[s] ?? s, cls: `st-${s}` } : "—"; }),
    OFFICIAL_LABEL[r.official] ?? r.official,
    ...(fp ? [r.punch ? fmtTime12(r.punch) : "—"] : []),
    followNote(r, fp),
  ];
  const subjectsLine = (c) => periods
    .map((p) => { const x = sched.get(`${c.grade}-${c.class_no}-${p}`); return x ? `ح${p}: ${x.subject}` : null; })
    .filter(Boolean).join(" · ");

  const print = () => printReport({
    title: "تقرير الحضور المفصل بالفصل", landscape: true, signOnLastPageOnly: false,
    sections: picked.map((c) => {
      const list = studentsOf(c); const s = statsOf(list);
      return {
        title: `تقرير الحضور المفصل — فصل ${c.code}`,
        subtitle: `${weekdayOf(date)} ${fmtDate(date)} · ${GRADE_NAMES[c.grade] ?? ""} · ${countAr(list.length, "student")}`,
        headers: head, tableClass: "compact",
        rows: [...list.map(rowCells),
          [{ text: "غياب الحصة", colspan: 2, cls: "total" }, ...periods.map((p) => ({ text: s.perPeriod[p], cls: "total" })),
           { text: `حاضر ${s.present} · غائب ${s.absent}`, cls: "total", colspan: fp ? 3 : 2 }]],
        note: `${LEGEND}${subjectsLine(c) ? `<br/>${subjectsLine(c)}` : ""}`,
      };
    }),
    ...logos(), signatures: SIGNS,
  });

  const excel = () => {
    const rows = [];
    picked.forEach((c) => studentsOf(c).forEach((r, i) => {
      rows.push([i + 1, c.code, r.full_name,
        ...periods.map((p) => (r.periods?.[p] ? stLabel(r.periods[p]) : "—")),
        OFFICIAL_LABEL[r.official] ?? r.official, ...(fp ? [r.punch ? fmtTime12(r.punch) : "—"] : []), followNote(r, fp)]);
    }));
    exportStyledExcel({
      title: "تقرير الحضور المفصل بالفصل", subtitle: `${weekdayOf(date)} ${fmtDate(date)}`,
      headers: ["م", "الفصل", "اسم الطالب", ...periods.map((p) => `الحصة ${p}`), "الحالة الرسمية", ...(fp ? ["البصمة"] : []), "المتابعة"],
      rows, fileName: `حضور-مفصل-بالفصل-${date}`, sheetName: "بالفصل", signatures: SIGNS,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DateInput value={date} onChange={setDate} />
        <ClassSelect classes={classes} value={cls} onChange={setCls} />
      </div>
      <GradePills grade={grade} setGrade={(g) => { setGrade(g); setCls(""); }} />
      <Note>كشف كل طالب حصةً حصة، مع حالته الرسمية وملاحظات المتابعة (الغياب بعد الحضور{fp ? "، وبصم ولم يحضر، والتأخر الصباحي" : ""}). عند اختيار «كل الفصول» يُطبع كل فصل في صفحة.</Note>
      <ExportBar disabled={!picked.length} onPrint={print} onExcel={excel} />
      {error && <Empty>تعذّر التحميل: {error}</Empty>}
      {!live && !error ? <Loading /> : live && !picked.length ? <Empty>لا طلاب في هذا الاختيار.</Empty> : live && picked.map((c) => {
        const list = studentsOf(c); const s = statsOf(list);
        return (
          <section key={c.key} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-bold text-ink">فصل <span className="num">{c.code}</span>
                <span className="mr-2 text-xs font-normal text-muted">{GRADE_NAMES[c.grade]} · <span className="num">{list.length}</span> طالبًا</span></h3>
              <p className="text-xs text-muted">
                حاضر <b className="num text-present">{s.present}</b> · غائب <b className="num text-absent">{s.absent}</b>
                {s.excused > 0 && <> · مستأذن <b className="num">{s.excused}</b></>}
                {s.pending > 0 && <> · لم يُرصد <b className="num">{s.pending}</b></>}
                {s.notes > 0 && <> · للمتابعة <b className="num text-warning">{s.notes}</b></>}
              </p>
            </div>
            <Table head={[
              "م", "اسم الطالب",
              ...periods.map((p) => {
                const x = sched.get(`${c.grade}-${c.class_no}-${p}`);
                return <span key={p} title={x ? `${x.subject} — ${x.teacher}` : ""}>ح<span className="num">{p}</span>
                  {x?.subject && <span className="block text-[10px] font-normal text-muted">{x.subject}</span>}</span>;
              }),
              "الرسمية", ...(fp ? ["البصمة"] : []), "المتابعة"]}>
              {list.map((r, i) => {
                const note = followNote(r, fp);
                return (
                  <tr key={r.student_id} className={note ? "bg-warning-light/30" : ""}>
                    <td className="num px-2 py-1.5 text-center text-muted">{i + 1}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 font-medium text-ink">{r.full_name}</td>
                    {periods.map((p) => {
                      const st = r.periods?.[p];
                      return <td key={p} className={`px-2 py-1.5 text-center ${CELL[st] ?? "text-faint"}`} title={stLabel(st)}>{st ? MARK[st] : "—"}</td>;
                    })}
                    <td className="whitespace-nowrap px-2 py-1.5 text-center text-xs">{OFFICIAL_LABEL[r.official] ?? r.official}</td>
                    {fp && <td className="num whitespace-nowrap px-2 py-1.5 text-center text-xs text-muted">{r.punch ? fmtTime12(r.punch) : "—"}</td>}
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-xs text-warning">{note}</td>
                  </tr>
                );
              })}
              <tr className="bg-canvas text-xs">
                <td colSpan={2} className="px-2.5 py-1.5 font-semibold text-muted">غياب الحصة</td>
                {periods.map((p) => <td key={p} className="num px-2 py-1.5 text-center font-bold text-absent">{s.perPeriod[p] || ""}</td>)}
                <td colSpan={fp ? 3 : 2} />
              </tr>
            </Table>
          </section>
        );
      })}
      {live && <p className="text-xs text-faint">{LEGEND}</p>}
    </div>
  );
}

/* ============================ 2) بالحصة ============================ */

function ByPeriod() {
  const [date, setDate] = useState(todayISO());
  const [grade, setGrade] = useState(0);
  const [period, setPeriod] = useState(1);
  const { live, error } = useDay(date);
  const classes = useClasses(live?.rows, grade);
  const periods = useMemo(() => dayPeriods(date, live?.rows), [date, live]);
  const sched = useMemo(() => scheduleMap(live?.schedule), [live]);

  const lines = useMemo(() => classes.map((c) => {
    const list = (live?.rows ?? []).filter((r) => classKey(r) === c.key);
    const n = { present: 0, absent: 0, late: 0, excused: 0, none: 0 };
    const absent = [], late = [], excused = [];
    list.forEach((r) => {
      const st = r.periods?.[period];
      if (!st) { n.none++; return; }
      n[st] = (n[st] ?? 0) + 1;
      if (st === "absent") absent.push(r.full_name);
      if (st === "late") late.push(r.full_name);
      if (st === "excused") excused.push(r.full_name);
    });
    const x = sched.get(`${c.grade}-${c.class_no}-${period}`);
    return { ...c, total: list.length, n, absent, late, excused, marked: n.none < list.length,
             subject: x?.subject ?? "", teacher: x?.teacher ?? "", scheduled: !!x };
  }).filter((l) => l.scheduled || l.marked), [classes, live, period, sched]);

  const tot = lines.reduce((t, l) => ({
    present: t.present + l.n.present, absent: t.absent + l.n.absent, late: t.late + l.n.late,
    excused: t.excused + l.n.excused, unmarked: t.unmarked + (l.marked ? 0 : 1),
  }), { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 });

  const names = (l) => [
    l.absent.length ? `غائب: ${l.absent.join("، ")}` : "",
    l.late.length ? `متأخر: ${l.late.join("، ")}` : "",
    l.excused.length ? `مستأذن: ${l.excused.join("، ")}` : "",
  ].filter(Boolean).join(" — ");
  const headers = ["م", "الفصل", "المادة", "المعلم", "الطلاب", "حاضر", "غائب", "متأخر", "مستأذن", "أسماء غير الحاضرين"];
  const table = () => lines.map((l, i) => [
    i + 1, l.code, l.subject, l.teacher, l.total,
    l.marked ? l.n.present : { text: "لم تُرصد", cls: "st-late", colspan: 4 },
    ...(l.marked ? [l.n.absent ? { text: l.n.absent, cls: "st-absent" } : 0, l.n.late, l.n.excused] : []),
    names(l),
  ]);
  const subtitle = `${weekdayOf(date)} ${fmtDate(date)} · الحصة ${period}${grade ? ` · ${GRADE_NAMES[grade]}` : ""}`;

  return (
    <div className="space-y-4">
      <DateInput value={date} onChange={setDate} />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-medium text-ink">الحصة:</span>
        {periods.map((p) => <Pill key={p} on={period === p} onClick={() => setPeriod(p)}><span className="num">{p}</span></Pill>)}
      </div>
      <GradePills grade={grade} setGrade={setGrade} />
      <ExportBar disabled={!lines.length}
        onPrint={() => printReport({ title: "تقرير الحضور المفصل بالحصة", subtitle, headers, rows: table(), tableClass: "compact", landscape: true, ...logos(), signatures: SIGNS })}
        onExcel={() => exportStyledExcel({
          title: "تقرير الحضور المفصل بالحصة", subtitle, headers,
          rows: lines.map((l, i) => [i + 1, l.code, l.subject, l.teacher, l.total,
            ...(l.marked ? [l.n.present, l.n.absent, l.n.late, l.n.excused] : ["لم تُرصد", "", "", ""]), names(l)]),
          fileName: `حضور-مفصل-الحصة-${period}-${date}`, sheetName: `الحصة ${period}`, signatures: SIGNS,
        })} />
      {error && <Empty>تعذّر التحميل: {error}</Empty>}
      {!live && !error ? <Loading /> : live && !lines.length ? <Empty>لا فصول مجدولة في هذه الحصة.</Empty> : live && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Fig value={tot.present} label="حاضر" tone="text-present" />
            <Fig value={tot.absent} label="غائب" tone="text-absent" />
            <Fig value={tot.late} label="متأخر" tone="text-warning" />
            <Fig value={tot.excused} label="مستأذن" />
            <Fig value={tot.unmarked} label="فصول لم تُرصد" tone={tot.unmarked ? "text-warning" : "text-ink"} />
          </div>
          <Table head={["الفصل", "المادة", "المعلم", "حاضر", "غائب", "متأخر", "مستأذن", "غير الحاضرين"]}>
            {lines.map((l) => (
              <tr key={l.key} className={!l.marked ? "bg-warning-light/40" : ""}>
                <td className="num px-2.5 py-2 text-center font-bold text-ink">{l.code}</td>
                <td className="whitespace-nowrap px-2.5 py-2">{l.subject || "—"}</td>
                <td className="whitespace-nowrap px-2.5 py-2 text-xs text-muted">{l.teacher || "—"}</td>
                {l.marked ? <>
                  <td className="num px-2 py-2 text-center text-present">{l.n.present}</td>
                  <td className={`num px-2 py-2 text-center ${l.n.absent ? CELL.absent : "text-faint"}`}>{l.n.absent}</td>
                  <td className={`num px-2 py-2 text-center ${l.n.late ? CELL.late : "text-faint"}`}>{l.n.late}</td>
                  <td className={`num px-2 py-2 text-center ${l.n.excused ? CELL.excused : "text-faint"}`}>{l.n.excused}</td>
                </> : <td colSpan={4} className="px-2 py-2 text-center text-xs font-semibold text-warning">لم تُرصد بعد</td>}
                <td className="min-w-[16rem] px-2.5 py-2 text-xs leading-relaxed text-muted">{names(l)}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </div>
  );
}

/* ============================ 3) بالطالب ============================ */

function ByStudent() {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState(null);
  const [student, setStudent] = useState(null);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(todayISO());
  const [recs, setRecs] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { loadRangeStart(todayISO()).then(setFrom).catch(() => setFrom(todayISO())); }, []);

  const search = async () => {
    const term = q.trim();
    if (term.length < 2) return;
    const { data } = await supabase.from("v_active_students")
      .select("student_id, full_name, class_no, grade")
      .ilike("full_name", `%${term}%`).order("full_name").limit(25);
    setOptions(data ?? []);
  };

  useEffect(() => {
    if (!student || !from) return;
    let alive = true;
    setRecs(null); setError(null);
    fetchAllPaged(() => supabase.from("class_attendance")
      .select("id, attend_date, status, schedule(period_no, subjects(name))")
      .eq("student_id", student.student_id).gte("attend_date", from).lte("attend_date", to)
      .order("id", { ascending: true }))
      .then((d) => { if (alive) setRecs(d); })
      .catch((e) => { if (alive) setError(e.message ?? String(e)); });
    return () => { alive = false; };
  }, [student, from, to]);

  // يوم لكل صف: حالة كل حصة، وحالة اليوم (غياب كامل إن لم يحضر أي حصة مرصودة)
  const days = useMemo(() => {
    const m = new Map();
    (recs ?? []).forEach((r) => {
      const p = r.schedule?.period_no; if (p == null) return;
      const d = m.get(r.attend_date) ?? { date: r.attend_date, periods: {}, subjects: {} };
      d.periods[p] = r.status; d.subjects[p] = r.schedule?.subjects?.name ?? "";
      m.set(r.attend_date, d);
    });
    return [...m.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).map((d) => {
      const v = Object.values(d.periods);
      const day = v.some((s) => s === "present" || s === "late") ? "present"
        : v.every((s) => s === "excused") ? "excused" : "absent";
      return { ...d, day };
    });
  }, [recs]);

  const maxP = Math.max(7, ...days.flatMap((d) => Object.keys(d.periods).map(Number)));
  const periods = Array.from({ length: maxP }, (_, i) => i + 1);
  const sum = days.reduce((s, d) => {
    s.days++; if (d.day === "absent") s.absentDays++;
    Object.values(d.periods).forEach((st) => { s[st] = (s[st] ?? 0) + 1; });
    return s;
  }, { days: 0, absentDays: 0, present: 0, absent: 0, late: 0, excused: 0 });
  const DAY_LABEL = { present: "حاضر", absent: "غائب اليوم", excused: "مستأذن" };

  const who = student ? `${student.full_name} · فصل ${classCode(student.grade, student.class_no)}` : "";
  const subtitle = from ? `${who} · من ${fmtDate(from)} إلى ${fmtDate(to)}` : who;
  const headers = ["م", "اليوم", "التاريخ", ...periods.map((p) => `ح${p}`), "حالة اليوم"];
  const summary = `أيام مرصودة ${sum.days} · غياب يوم كامل ${daysWord(sum.absentDays)} · حصص الغياب ${sum.absent} · التأخر ${sum.late} · الاستئذان ${sum.excused}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input className="field min-w-[14rem] flex-1" value={q} placeholder="ابحث باسم الطالب"
               onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
        <button onClick={search} className="rounded-sm2 bg-mint-deep px-4 py-2 text-sm font-semibold text-white">بحث</button>
      </div>
      {options && !student && (options.length ? (
        <div className="card divide-y divide-line overflow-hidden">
          {options.map((o) => (
            <button key={o.student_id} onClick={() => setStudent(o)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-right hover:bg-canvas">
              <span className="text-sm font-medium text-ink">{o.full_name}</span>
              <span className="text-xs text-muted">فصل <span className="num">{classCode(o.grade, o.class_no)}</span></span>
            </button>
          ))}
        </div>
      ) : <Empty>لا نتائج.</Empty>)}

      {student && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-mint-tint/40 px-4 py-3">
            <p className="text-sm font-bold text-ink">{student.full_name}
              <span className="mr-2 text-xs font-normal text-muted">{GRADE_NAMES[student.grade]} · فصل <span className="num">{classCode(student.grade, student.class_no)}</span></span></p>
            <button onClick={() => { setStudent(null); setRecs(null); }} className="text-xs font-semibold text-mint-deep">طالب آخر</button>
          </div>
          <div className="flex flex-wrap gap-3">
            {from && <DateInput label="من" value={from} onChange={setFrom} />}
            <DateInput label="إلى" value={to} onChange={setTo} />
          </div>
          <ExportBar disabled={!days.length}
            onPrint={() => printReport({
              title: "تقرير الحضور المفصل للطالب", subtitle, headers, tableClass: "compact", landscape: true,
              rows: days.map((d, i) => [i + 1, weekdayOf(d.date), fmtDate(d.date),
                ...periods.map((p) => { const s = d.periods[p]; return s ? { text: MARK[s], cls: `st-${s}` } : "—"; }),
                d.day === "absent" ? { text: DAY_LABEL[d.day], cls: "st-absent" } : DAY_LABEL[d.day]]),
              note: `${summary}<br/>${LEGEND}`, ...logos(), signatures: SIGNS,
            })}
            onExcel={() => exportStyledExcel({
              title: "تقرير الحضور المفصل للطالب", subtitle, headers,
              rows: days.map((d, i) => [i + 1, weekdayOf(d.date), d.date,
                ...periods.map((p) => (d.periods[p] ? `${stLabel(d.periods[p])}${d.subjects[p] ? ` (${d.subjects[p]})` : ""}` : "—")),
                DAY_LABEL[d.day]]),
              note: summary, fileName: `حضور-مفصل-${student.full_name}`, sheetName: "الطالب", signatures: SIGNS,
            })} />
          {error && <Empty>تعذّر التحميل: {error}</Empty>}
          {!recs && !error ? <Loading /> : recs && !days.length ? <Empty>لا سجلات حضور في هذه الفترة.</Empty> : recs && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Fig value={sum.days} label="أيام مرصودة" />
                <Fig value={sum.absentDays} label="غياب يوم كامل" tone="text-absent" />
                <Fig value={sum.absent} label="حصص الغياب" tone="text-absent" />
                <Fig value={sum.late} label="مرات التأخر" tone="text-warning" />
                <Fig value={sum.excused} label="حصص الاستئذان" />
              </div>
              <Table head={["اليوم", "التاريخ", ...periods.map((p) => `ح${p}`), "حالة اليوم"]}>
                {days.map((d) => (
                  <tr key={d.date} className={d.day === "absent" ? "bg-absent/5" : ""}>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-xs text-muted">{weekdayOf(d.date)}</td>
                    <td className="num whitespace-nowrap px-2.5 py-1.5 text-xs">{fmtDate(d.date)}</td>
                    {periods.map((p) => {
                      const st = d.periods[p];
                      return <td key={p} title={st ? `${stLabel(st)}${d.subjects[p] ? ` — ${d.subjects[p]}` : ""}` : ""}
                                 className={`px-2 py-1.5 text-center ${CELL[st] ?? "text-faint"}`}>{st ? MARK[st] : "—"}</td>;
                    })}
                    <td className={`whitespace-nowrap px-2.5 py-1.5 text-center text-xs ${d.day === "absent" ? "font-bold text-absent" : "text-muted"}`}>{DAY_LABEL[d.day]}</td>
                  </tr>
                ))}
              </Table>
              <p className="text-xs text-faint">{LEGEND}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
