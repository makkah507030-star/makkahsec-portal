import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { GRADE_NAMES, STATUS } from "../lib/schoolTime";
import { exportToExcel, printReport, STUDENT_DEPUTY_NAME } from "../lib/exportUtils";
import ColorLegend, { ATTENDANCE_LEGEND } from "../components/ColorLegend.jsx";
import { fmtGreg, fmtTime12 } from "../lib/dates";
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";

const TABS = [
  { key: "daily",   label: "تقرير يومي" },
  { key: "student", label: "تقرير طالب" },
  { key: "period",  label: "تقرير فترة" },
  { key: "escape",  label: "بصم ولم يحضر" },
];

const NON_PRESENT = ["absent", "late", "excused"];
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const label = (s) => STATUS[s]?.label ?? s;

export default function Reports() {
  const { profile, session } = useSession();
  const isTeacher = profile?.role === "teacher";

  const [tab, setTab] = useState("daily");
  const [scopeIds, setScopeIds] = useState(null); // schedule ids للمعلم، أو null = الكل
  const [ready, setReady] = useState(false);

  // نطاق المعلم: حصصه فقط
  useEffect(() => {
    (async () => {
      if (!isTeacher) { setScopeIds(null); setReady(true); return; }
      const { data: t } = await supabase
        .from("teachers").select("id").eq("user_id", session?.user?.id).maybeSingle();
      if (!t) { setScopeIds([]); setReady(true); return; }
      const { data: sch } = await supabase
        .from("schedule").select("id").eq("teacher_id", t.id);
      setScopeIds((sch ?? []).map((r) => r.id));
      setReady(true);
    })();
  }, [isTeacher, session]);

  if (!ready) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">تقارير الحضور والغياب</h1>
        <p className="mt-1 text-sm text-muted">
          {isTeacher
            ? "التقارير مقصورة على الحصص المسندة إليك."
            : "تقارير شاملة لجميع الفصول."}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-mint-deep text-white"
                            : "border border-line bg-paper text-muted hover:bg-canvas"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <ColorLegend items={ATTENDANCE_LEGEND.slice(1)} />

      {tab === "daily"   && <DailyReport scopeIds={scopeIds} />}
      {tab === "student" && <StudentReport scopeIds={scopeIds} />}
      {tab === "period"  && <PeriodReport scopeIds={scopeIds} />}
      {tab === "escape"  && <EscapeReport scopeIds={scopeIds} />}
    </div>
  );
}

/* ============================ أدوات مشتركة ============================ */

function applyScope(query, scopeIds) {
  if (scopeIds === null) return query;
  if (scopeIds.length === 0) return query.in("schedule_id", ["00000000-0000-0000-0000-000000000000"]);
  return query.in("schedule_id", scopeIds);
}

function ExportBar({ disabled, onExcel, onPrint }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={onExcel} disabled={disabled}
        className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
        تصدير Excel
      </button>
      <button onClick={onPrint} disabled={disabled}
        className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
        طباعة / PDF
      </button>
    </div>
  );
}

const logos = () => ({
  logoUrl: new URL(logoIcon, window.location.origin).href,
  moeLogoUrl: new URL(moeLogo, window.location.origin).href,
  secondSignature: { title: "وكيل شؤون الطلاب", name: STUDENT_DEPUTY_NAME },
});

/* ============================ 1) تقرير يومي ============================ */

function DailyReport({ scopeIds }) {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("all");

  useEffect(() => {
    (async () => {
      setRows(null);
      let q = supabase
        .from("class_attendance")
        .select("student_id, status, students(full_name, national_id), schedule(period_no, classes(class_no, grade), subjects(name))")
        .eq("attend_date", date)
        .in("status", NON_PRESENT);
      q = applyScope(q, scopeIds);
      const { data } = await q;
      setRows(data ?? []);
    })();
  }, [date, scopeIds]);

  const filtered = useMemo(
    () => (status === "all" ? rows ?? [] : (rows ?? []).filter((r) => r.status === status)),
    [rows, status]
  );

  const counts = useMemo(() => {
    const c = { all: rows?.length ?? 0, absent: 0, late: 0, excused: 0 };
    (rows ?? []).forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  const table = () =>
    filtered
      .slice()
      .sort((a, b) =>
        (a.schedule?.classes?.class_no ?? 0) - (b.schedule?.classes?.class_no ?? 0) ||
        (a.schedule?.period_no ?? 0) - (b.schedule?.period_no ?? 0))
      .map((r, i) => [
        i + 1,
        r.students?.national_id ?? "",
        r.students?.full_name ?? "",
        r.schedule?.classes?.class_no ?? "",
        r.schedule?.period_no ?? "",
        r.schedule?.subjects?.name ?? "",
        label(r.status),
      ]);

  const headers = ["م", "رقم الهوية", "اسم الطالب", "الفصل", "الحصة", "المادة", "الحالة"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-ink">التاريخ:</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
               className="rounded-sm2 border border-line px-3 py-2 text-sm" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Pill on={status === "all"} onClick={() => setStatus("all")}>
          الكل <span className="num">({counts.all})</span>
        </Pill>
        {NON_PRESENT.map((s) => (
          <Pill key={s} on={status === s} onClick={() => setStatus(s)}>
            {label(s)} <span className="num">({counts[s] ?? 0})</span>
          </Pill>
        ))}
      </div>

      <ExportBar
        disabled={!filtered.length}
        onExcel={() =>
          exportToExcel(
            table().map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]]))),
            `غياب-${date}`, "الغياب"
          )}
        onPrint={() =>
          printReport({
            title: "تقرير الغياب اليومي",
            subtitle: date,
            headers, rows: table(), ...logos(),
          })}
      />

      {!rows && <p className="text-sm text-muted">جارٍ التحميل…</p>}

      {rows && filtered.length === 0 ? (
        <Empty title="لا سجلات" body="لا توجد حالات غياب أو تأخر في هذا اليوم." />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {filtered.slice(0, 300).map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {r.students?.full_name}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  فصل <span className="num">{r.schedule?.classes?.class_no}</span> · الحصة{" "}
                  <span className="num">{r.schedule?.period_no}</span> ·{" "}
                  {r.schedule?.subjects?.name ?? "—"}
                </p>
              </div>
              <StatusChip status={r.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================ 2) تقرير طالب ============================ */

function StudentReport({ scopeIds }) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState([]);
  const [student, setStudent] = useState(null);
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState(null);

  const search = async () => {
    const term = q.trim();
    if (term.length < 3) return;
    const { data } = await supabase
      .from("v_active_students")
      .select("student_id, full_name, national_id, class_no, grade")
      .or(`full_name.ilike.%${term}%,national_id.ilike.%${term}%`)
      .limit(20);
    setOptions(data ?? []);
  };

  useEffect(() => {
    if (!student) { setRows(null); return; }
    (async () => {
      setRows(null);
      let query = supabase
        .from("class_attendance")
        .select("attend_date, status, schedule(period_no, subjects(name))")
        .eq("student_id", student.student_id)
        .gte("attend_date", from)
        .lte("attend_date", to)
        .in("status", NON_PRESENT)
        .order("attend_date", { ascending: false });
      query = applyScope(query, scopeIds);
      const { data } = await query;
      setRows(data ?? []);
    })();
  }, [student, from, to, scopeIds]);

  const totals = useMemo(() => {
    const c = { absent: 0, late: 0, excused: 0 };
    (rows ?? []).forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  const headers = ["م", "التاريخ", "الحصة", "المادة", "الحالة"];
  const table = () =>
    (rows ?? []).map((r, i) => [
      i + 1, fmtGreg(r.attend_date + "T00:00:00"), r.schedule?.period_no ?? "",
      r.schedule?.subjects?.name ?? "", label(r.status),
    ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input className="field flex-1" value={q} placeholder="ابحث باسم الطالب أو رقم هويته"
               onChange={(e) => setQ(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && search()} />
        <button className="btn-primary" onClick={search}>بحث</button>
      </div>

      {options.length > 0 && !student && (
        <div className="card max-h-56 divide-y divide-line overflow-auto">
          {options.map((s) => (
            <button key={s.student_id} onClick={() => { setStudent(s); setOptions([]); }}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-right hover:bg-mint-tint">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{s.full_name}</span>
                <span className="num block text-xs text-faint">{s.national_id}</span>
              </span>
              <span className="num chip bg-mint-tint text-mint-deep">{s.class_no}</span>
            </button>
          ))}
        </div>
      )}

      {student && (
        <>
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-bold text-ink">{student.full_name}</p>
              <p className="mt-0.5 text-xs text-muted">
                <span className="num">{student.national_id}</span> ·{" "}
                {GRADE_NAMES[student.grade]} · فصل <span className="num">{student.class_no}</span>
              </p>
            </div>
            <button onClick={() => { setStudent(null); setRows(null); }}
                    className="text-xs font-medium text-absent hover:underline">
              تغيير الطالب
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-muted">من</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                   className="rounded-sm2 border border-line px-3 py-2 text-sm" />
            <label className="text-sm text-muted">إلى</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                   className="rounded-sm2 border border-line px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {NON_PRESENT.map((s) => (
              <div key={s} className="rounded-card border border-line bg-white px-4 py-3 text-center">
                <p className="num text-2xl font-bold text-mint-deep">{totals[s] ?? 0}</p>
                <p className="mt-1 text-xs text-muted">{label(s)}</p>
              </div>
            ))}
          </div>

          <ExportBar
            disabled={!rows?.length}
            onExcel={() =>
              exportToExcel(
                table().map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]]))),
                `سجل-${student.full_name}`, "السجل"
              )}
            onPrint={() =>
              printReport({
                title: `سجل حضور: ${student.full_name}`,
                subtitle: `${from} — ${to} · فصل ${student.class_no}`,
                headers, rows: table(), ...logos(),
              })}
          />

          {!rows && <p className="text-sm text-muted">جارٍ التحميل…</p>}
          {rows && rows.length === 0 && (
            <Empty title="سجل نظيف" body="لا غياب ولا تأخر خلال هذه الفترة." />
          )}

          {rows && rows.length > 0 && (
            <div className="card divide-y divide-line overflow-hidden">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="num text-sm font-medium text-ink">{fmtGreg(r.attend_date + "T00:00:00")}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      الحصة <span className="num">{r.schedule?.period_no}</span> ·{" "}
                      {r.schedule?.subjects?.name ?? "—"}
                    </p>
                  </div>
                  <StatusChip status={r.status} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================ 3) تقرير فترة ============================ */

function PeriodReport({ scopeIds }) {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState(null);
  const [grade, setGrade] = useState(0);
  const [cls, setCls] = useState(0);

  useEffect(() => {
    (async () => {
      setRows(null);
      let q = supabase
        .from("class_attendance")
        .select("student_id, status, students(full_name, national_id), schedule(classes(class_no, grade))")
        .gte("attend_date", from)
        .lte("attend_date", to)
        .in("status", NON_PRESENT)
        .limit(5000);
      q = applyScope(q, scopeIds);
      const { data } = await q;
      setRows(data ?? []);
    })();
  }, [from, to, scopeIds]);

  // تجميع حسب الطالب
  const summary = useMemo(() => {
    const map = new Map();
    (rows ?? []).forEach((r) => {
      const id = r.student_id;
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: r.students?.full_name ?? "",
          national_id: r.students?.national_id ?? "",
          class_no: r.schedule?.classes?.class_no ?? 0,
          grade: r.schedule?.classes?.grade ?? 0,
          absent: 0, late: 0, excused: 0, total: 0,
        });
      }
      const row = map.get(id);
      row[r.status] = (row[r.status] ?? 0) + 1;
      row.total += 1;
    });
    return [...map.values()].sort((a, b) => b.absent - a.absent || b.total - a.total);
  }, [rows]);

  const classList = useMemo(
    () => [...new Set(summary.map((s) => s.class_no))].filter(Boolean).sort((a, b) => a - b),
    [summary]
  );

  const filtered = useMemo(
    () => summary.filter((s) =>
      (!grade || s.grade === grade) && (!cls || s.class_no === cls)),
    [summary, grade, cls]
  );

  const headers = ["م", "رقم الهوية", "اسم الطالب", "الفصل", "غياب", "تأخر", "استئذان", "الإجمالي"];
  const table = () =>
    filtered.map((s, i) => [
      i + 1, s.national_id, s.name, s.class_no, s.absent, s.late, s.excused, s.total,
    ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">من</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
               className="rounded-sm2 border border-line px-3 py-2 text-sm" />
        <label className="text-sm text-muted">إلى</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
               className="rounded-sm2 border border-line px-3 py-2 text-sm" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Pill on={!grade} onClick={() => { setGrade(0); setCls(0); }}>كل الصفوف</Pill>
        {[1, 2, 3].map((g) => (
          <Pill key={g} on={grade === g} onClick={() => { setGrade(g); setCls(0); }}>
            {GRADE_NAMES[g]}
          </Pill>
        ))}
      </div>

      {classList.length > 1 && (
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-1.5 pb-1">
            <Pill on={!cls} onClick={() => setCls(0)}>كل الفصول</Pill>
            {classList
              .filter((c) => !grade || Math.floor(c / 100) === grade)
              .map((c) => (
                <Pill key={c} on={cls === c} onClick={() => setCls(c)}>
                  <span className="num">{c}</span>
                </Pill>
              ))}
          </div>
        </div>
      )}

      <ExportBar
        disabled={!filtered.length}
        onExcel={() =>
          exportToExcel(
            table().map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]]))),
            `ملخص-الغياب-${from}_${to}`, "الملخص"
          )}
        onPrint={() =>
          printReport({
            title: "ملخص الغياب والتأخر",
            subtitle: `${from} — ${to}`,
            headers, rows: table(), ...logos(),
          })}
      />

      {!rows && <p className="text-sm text-muted">جارٍ التحميل…</p>}

      {rows && filtered.length === 0 ? (
        <Empty title="لا سجلات" body="لا حالات غياب أو تأخر في هذه الفترة." />
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-line px-4 py-2.5 text-xs font-semibold text-muted">
            <span>الطالب</span>
            <span>غياب · تأخر · استئذان</span>
          </div>
          {filtered.slice(0, 300).map((s) => (
            <div key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  فصل <span className="num">{s.class_no}</span> ·{" "}
                  <span className="num">{s.national_id}</span>
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <span className="num chip bg-absent/10 text-absent">{s.absent}</span>
                <span className="num chip bg-late/10 text-late">{s.late}</span>
                <span className="num chip bg-excused/10 text-excused">{s.excused}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================== بصم ولم يحضر (الهروب) ==================== */

function EscapeReport({ scopeIds }) {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState(null);

  useEffect(() => {
    (async () => {
      setRows(null);

      // 1) من بصم اليوم
      const { data: punches } = await supabase
        .from("daily_attendance")
        .select("student_id, punch_time")
        .eq("attend_date", date);

      const punchedIds = (punches ?? []).map((p) => p.student_id);
      if (!punchedIds.length) { setRows([]); return; }

      const punchBy = Object.fromEntries(
        (punches ?? []).map((p) => [p.student_id, p.punch_time])
      );

      // 2) سجلات حصص اليوم لهؤلاء الطلاب
      let q = supabase
        .from("class_attendance")
        .select("student_id, status, students(full_name, national_id), schedule(period_no, classes(class_no, grade), subjects(name))")
        .eq("attend_date", date)
        .in("student_id", punchedIds);
      q = applyScope(q, scopeIds);

      const { data: recs } = await q;

      // 3) تجميع حسب الطالب
      const map = new Map();
      (recs ?? []).forEach((r) => {
        const id = r.student_id;
        if (!map.has(id)) {
          map.set(id, {
            id,
            name: r.students?.full_name ?? "",
            national_id: r.students?.national_id ?? "",
            class_no: r.schedule?.classes?.class_no ?? 0,
            punch: punchBy[id],
            absentPeriods: [],
            presentPeriods: [],
          });
        }
        const row = map.get(id);
        const pn = r.schedule?.period_no;
        if (pn == null) return;
        if (r.status === "absent") row.absentPeriods.push(pn);
        else if (r.status !== "excused") row.presentPeriods.push(pn);
      });

      // 4) من غاب عن حصة أو أكثر رغم البصمة
      const out = [...map.values()]
        .filter((r) => r.absentPeriods.length > 0)
        .map((r) => {
          r.absentPeriods.sort((a, b) => a - b);
          r.presentPeriods.sort((a, b) => a - b);
          const firstAbsent = r.absentPeriods[0];
          const attendedBefore = r.presentPeriods.some((p) => p < firstAbsent);
          return {
            ...r,
            firstAbsent,
            // حضر حصصًا ثم غاب = هروب أرجح
            likelyEscape: attendedBefore,
          };
        })
        .sort((a, b) =>
          Number(b.likelyEscape) - Number(a.likelyEscape) ||
          b.absentPeriods.length - a.absentPeriods.length
        );

      setRows(out);
    })();
  }, [date, scopeIds]);

  const headers = ["م", "رقم الهوية", "اسم الطالب", "الفصل", "وقت البصمة", "حصص الغياب", "أول حصة غياب", "التصنيف"];

  const table = () =>
    (rows ?? []).map((r, i) => [
      i + 1,
      r.national_id,
      r.name,
      r.class_no,
      r.punch ? fmtTime12(r.punch) : "",
      r.absentPeriods.join("، "),
      r.firstAbsent,
      r.likelyEscape ? "هروب مُرجَّح" : "غياب من البداية",
    ]);

  const escapes = (rows ?? []).filter((r) => r.likelyEscape).length;

  return (
    <div className="space-y-4">
      <p className="rounded-card border border-[#CCF2DB] bg-mint-tint px-4 py-3 text-sm leading-relaxed text-mint-deep">
        طلاب سجّلوا بصمة الدخول الصباحية، لكنهم غابوا عن حصة أو أكثر في اليوم نفسه.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-ink">التاريخ:</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
               className="rounded-sm2 border border-line px-3 py-2 text-sm" />
      </div>

      {rows && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-card border border-line bg-white px-4 py-3 text-center">
            <p className="num text-2xl font-bold leading-none text-absent">{escapes}</p>
            <p className="mt-1.5 text-xs text-muted">هروب مُرجَّح</p>
          </div>
          <div className="rounded-card border border-line bg-white px-4 py-3 text-center">
            <p className="num text-2xl font-bold leading-none text-late">{rows.length - escapes}</p>
            <p className="mt-1.5 text-xs text-muted">غياب من بداية اليوم</p>
          </div>
        </div>
      )}

      <ExportBar
        disabled={!rows?.length}
        onExcel={() =>
          exportToExcel(
            table().map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]]))),
            `بصم-ولم-يحضر-${date}`, "الحالات"
          )}
        onPrint={() =>
          printReport({
            title: "تقرير: بصم ولم يحضر",
            subtitle: date,
            headers, rows: table(), ...logos(),
          })}
      />

      {!rows && <p className="text-sm text-muted">جارٍ التحميل…</p>}

      {rows && rows.length === 0 ? (
        <Empty title="لا حالات" body="لا يوجد طلاب بصموا وغابوا عن حصصهم في هذا اليوم." />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {rows?.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{r.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    فصل <span className="num">{r.class_no}</span> · بصم{" "}
                    <span className="num">
{r.punch ? fmtTime12(r.punch) : "—"}
                    </span>
                  </p>
                </div>
                <span className={`chip shrink-0 ${
                  r.likelyEscape ? "bg-absent/10 font-semibold text-absent"
                                 : "bg-late/10 text-late"}`}>
                  {r.likelyEscape ? "هروب مُرجَّح" : "غياب من البداية"}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-faint">حصص الغياب:</span>
                {r.absentPeriods.map((p) => (
                  <span key={p} className="num chip bg-absent/10 text-absent">{p}</span>
                ))}
                {r.presentPeriods.length > 0 && (
                  <>
                    <span className="ms-2 text-xs text-faint">حضر:</span>
                    {r.presentPeriods.map((p) => (
                      <span key={p} className="num chip bg-present/10 text-present">{p}</span>
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================ عناصر صغيرة ============================ */

function StatusChip({ status }) {
  const cls = {
    absent: "bg-absent/10 text-absent",
    late: "bg-late/10 text-late",
    excused: "bg-excused/10 text-excused",
  }[status] ?? "bg-gray-tint text-muted";
  return <span className={`chip shrink-0 ${cls}`}>{label(status)}</span>;
}

function Pill({ on, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 rounded-pill px-3 py-1.5 text-sm font-medium transition-colors ${
        on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`}>
      {children}
    </button>
  );
}

function Empty({ title, body }) {
  return (
    <div className="card px-6 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
