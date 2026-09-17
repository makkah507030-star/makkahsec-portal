import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { GRADE_NAMES, STATUS } from "../lib/schoolTime";
import { exportStyledExcel, printReport, STUDENT_DEPUTY_NAME, PRINCIPAL_NAME } from "../lib/exportUtils";
import ColorLegend, { ATTENDANCE_LEGEND } from "../components/ColorLegend.jsx";
import { fmtGreg, fmtTime12 } from "../lib/dates";
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";

const TAB_GROUPS = [
  {
    title: "تقارير اليوم الدراسي",
    tabs: [
      { key: "daily_rate", label: "معدل الحضور اليومي" },
      { key: "days", label: "أيام الغياب" },
    ],
  },
  {
    title: "تقارير الحصص",
    tabs: [
      { key: "daily",   label: "تقرير يومي" },
      { key: "student", label: "تقرير طالب" },
      { key: "period",  label: "تقرير فترة" },
    ],
  },
];

const TABS = TAB_GROUPS.flatMap((g) => g.tabs);

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

      <div className="space-y-3">
        {TAB_GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 text-[11px] font-semibold text-faint">{g.title}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.tabs.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
                    tab === t.key ? "bg-mint-deep text-white"
                                  : "border border-line bg-paper text-muted hover:bg-canvas"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <ColorLegend items={ATTENDANCE_LEGEND.slice(1)} />

      {tab === "daily"   && <DailyReport scopeIds={scopeIds} />}
      {tab === "student" && <StudentReport scopeIds={scopeIds} />}
      {tab === "period"  && <PeriodReport scopeIds={scopeIds} />}
      {tab === "daily_rate" && <DailyRateReport />}
      {tab === "days"    && <AbsenceDaysReport scopeIds={scopeIds} />}
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

const SIGNS = [
  { title: "وكيل شؤون الطلاب", name: STUDENT_DEPUTY_NAME },
  { title: "مدير المدرسة", name: PRINCIPAL_NAME },
];

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
          exportStyledExcel({
            title: "تقرير الغياب اليومي",
            subtitle: date,
            headers,
            rows: table(),
            fileName: `غياب-${date}`,
            sheetName: "الغياب",
            signatures: SIGNS,
          })}
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
              exportStyledExcel({
            title: `سجل حضور: ${student.full_name}`,
            subtitle: `${from} — ${to} · فصل ${student.class_no}`,
            headers,
            rows: table(),
            fileName: `سجل-${student.full_name}`,
            sheetName: "السجل",
            signatures: SIGNS,
          })}
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
          exportStyledExcel({
            title: "ملخص الغياب والتأخر",
            subtitle: `${from} — ${to}`,
            headers,
            rows: table(),
            fileName: `ملخص-الغياب-${from}_${to}`,
            sheetName: "الملخص",
            signatures: SIGNS,
          })}
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

/* ==================== معدل الحضور اليومي ==================== */

function DailyRateReport() {
  const [from, setFrom] = useState(daysAgo(120));
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState(null);

  useEffect(() => {
    (async () => {
      setRows(null);
      const { data, error } = await supabase.rpc("official_status_by_day", {
        p_from: from, p_to: to,
      });
      if (error) { console.error(error); setRows([]); return; }
      setRows(data ?? []);
    })();
  }, [from, to]);

  const withPct = useMemo(
    () =>
      (rows ?? []).map((r) => {
        const resolved = r.present + r.absent;
        return {
          ...r,
          pct: resolved ? Math.round((r.present / resolved) * 100) : null,
        };
      }),
    [rows]
  );

  const totals = useMemo(() => {
    const t = (rows ?? []).reduce(
      (acc, r) => {
        acc.present += r.present;
        acc.absent += r.absent;
        acc.pending += r.pending;
        return acc;
      },
      { present: 0, absent: 0, pending: 0 }
    );
    const resolved = t.present + t.absent;
    t.pct = resolved ? Math.round((t.present / resolved) * 100) : null;
    return t;
  }, [rows]);

  const headers = ["م", "التاريخ", "حاضر", "غائب", "نسبة الحضور"];
  const dayRows = withPct.map((r, i) => [
    i + 1, fmtGreg(r.attend_date + "T00:00:00"), r.present, r.absent,
    r.pct != null ? `${r.pct}%` : "—",
  ]);
  const totalPlain = ["", "الإجمالي — الفصل الدراسي", totals.present, totals.absent,
    totals.pct != null ? `${totals.pct}%` : "—"];

  // للتصدير: Excel يحتاج قيمًا مباشرة
  const table = () => [...dayRows, totalPlain];

  // للطباعة: صف الإجمالي بصنف مميَّز يُلوَّن في PDF
  const tablePdf = () => [
    ...dayRows,
    totalPlain.map((v) => ({ text: String(v), cls: "total" })),
  ];

  const printIt = () =>
    printReport({
      title: "معدل الحضور والغياب اليومي",
      subtitle: `${fmtGreg(from + "T00:00:00")} — ${fmtGreg(to + "T00:00:00")}`,
      headers, rows: tablePdf(),
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      signatures: [
        { title: "وكيل شؤون الطلاب", name: STUDENT_DEPUTY_NAME },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
    });

  const excelIt = () =>
    exportStyledExcel({
      title: "معدل الحضور والغياب اليومي",
      subtitle: `${fmtGreg(from + "T00:00:00")} — ${fmtGreg(to + "T00:00:00")}`,
      headers, rows: table(),
      fileName: `معدل-الحضور-اليومي-${from}_${to}`,
      sheetName: "المعدل اليومي",
      signatures: [
        { title: "وكيل شؤون الطلاب", name: STUDENT_DEPUTY_NAME },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
    });

  return (
    <div className="space-y-4">
      <p className="rounded-card border border-[#CCF2DB] bg-mint-tint px-4 py-3 text-sm leading-relaxed text-mint-deep">
        نسبة الحضور محسوبة يوميًا بنفس قاعدة الحضور الرسمي (الحصتان الأولى
        والثانية)، وفي آخر السجل مجموع وإجمالي نسبة الفصل الدراسي كاملًا.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">من</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
               className="rounded-sm2 border border-line px-3 py-2 text-sm" />
        <label className="text-sm text-muted">إلى</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
               className="rounded-sm2 border border-line px-3 py-2 text-sm" />
      </div>

      {rows && rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-card border border-line bg-white px-4 py-3 text-center">
            <p className="num text-2xl font-bold leading-none text-mint-deep">
              {totals.pct != null ? `${totals.pct}%` : "—"}
            </p>
            <p className="mt-1.5 text-xs text-muted">نسبة الفصل كاملًا</p>
          </div>
          <div className="rounded-card border border-line bg-white px-4 py-3 text-center">
            <p className="num text-2xl font-bold leading-none text-ink">{rows.length}</p>
            <p className="mt-1.5 text-xs text-muted">يوم دراسي مسجَّل</p>
          </div>
          <div className="rounded-card border border-line bg-white px-4 py-3 text-center">
            <p className="num text-2xl font-bold leading-none text-absent">
              {totals.absent.toLocaleString("ar")}
            </p>
            <p className="mt-1.5 text-xs text-muted">إجمالي حالات الغياب</p>
          </div>
        </div>
      )}

      <ExportBar
        disabled={!rows?.length}
        onExcel={excelIt}
        onPrint={printIt}
      />

      {!rows && <p className="text-sm text-muted">جارٍ التحميل…</p>}
      {rows && rows.length === 0 && (
        <Empty title="لا بيانات" body="لا توجد أيام دراسية مسجَّلة في هذه الفترة." />
      )}

      {withPct.length > 0 && (
        <div className="card divide-y divide-line overflow-hidden">
          {withPct.map((r) => (
            <div key={r.attend_date} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="num text-sm font-medium text-ink">
                {fmtGreg(r.attend_date + "T00:00:00")}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="num chip bg-present/10 text-present">{r.present}</span>
                <span className="num chip bg-absent/10 text-absent">{r.absent}</span>
                {r.pending > 0 && (
                  <span className="num chip bg-warning-light text-warning">{r.pending} لم يُحضَّر</span>
                )}
                <span className="num w-12 text-left text-sm font-bold text-mint-deep">
                  {r.pct != null ? `${r.pct}%` : "—"}
                </span>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 bg-mint-tint px-4 py-3">
            <span className="text-sm font-bold text-mint-deep">
              الإجمالي — الفصل الدراسي كاملًا
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="num chip bg-present/15 font-semibold text-present">{totals.present}</span>
              <span className="num chip bg-absent/15 font-semibold text-absent">{totals.absent}</span>
              <span className="num w-12 text-left text-base font-bold text-mint-deep">
                {totals.pct != null ? `${totals.pct}%` : "—"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const YELLOW_AT = 10;
const RED_AT = 15;

function AbsenceDaysReport({ scopeIds }) {
  const [from, setFrom] = useState(daysAgo(120));
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState(null);
  const [view, setView] = useState("over");   // over | best
  const [grade, setGrade] = useState(0);

  useEffect(() => {
    (async () => {
      setRows(null);

      // كل سجلات الحضور في الفترة
      let q = supabase
        .from("class_attendance")
        .select("student_id, attend_date, status, students(full_name, national_id), schedule(classes(class_no, grade))")
        .gte("attend_date", from)
        .lte("attend_date", to)
        .limit(20000);
      q = applyScope(q, scopeIds);

      const { data } = await q;

      // تجميع: لكل طالب ولكل يوم — هل غاب كل حصصه؟
      const byStudent = new Map();

      (data ?? []).forEach((r) => {
        const id = r.student_id;
        if (!byStudent.has(id)) {
          byStudent.set(id, {
            id,
            name: r.students?.full_name ?? "",
            national_id: r.students?.national_id ?? "",
            class_no: r.schedule?.classes?.class_no ?? 0,
            grade: r.schedule?.classes?.grade ?? 0,
            days: new Map(), // date -> { total, absent }
          });
        }
        const st = byStudent.get(id);
        const d = (st.days.get(r.attend_date) ?? { total: 0, absent: 0 });
        d.total += 1;
        if (r.status === "absent") d.absent += 1;
        st.days.set(r.attend_date, d);
      });

      // يوم غياب كامل = غاب عن جميع حصص ذلك اليوم
      const out = [...byStudent.values()].map((st) => {
        let full = 0, partial = 0, present = 0;
        st.days.forEach((d) => {
          if (d.absent === 0) present += 1;
          else if (d.absent === d.total) full += 1;
          else partial += 1;
        });
        return {
          id: st.id, name: st.name, national_id: st.national_id,
          class_no: st.class_no, grade: st.grade,
          fullDays: full, partialDays: partial, presentDays: present,
          recordedDays: st.days.size,
        };
      });

      setRows(out);
    })();
  }, [from, to, scopeIds]);

  const filtered = useMemo(() => {
    let list = (rows ?? []).filter((r) => !grade || r.grade === grade);
    if (view === "over") {
      list = list.filter((r) => r.fullDays >= YELLOW_AT)
                 .sort((a, b) => b.fullDays - a.fullDays);
    } else {
      // التميز: الأقل غيابًا، ومن لديه سجل حضور فعلي
      list = list.filter((r) => r.recordedDays >= 5)
                 .sort((a, b) =>
                   a.fullDays - b.fullDays ||
                   a.partialDays - b.partialDays ||
                   b.presentDays - a.presentDays)
                 .slice(0, 100);
    }
    return list;
  }, [rows, view, grade]);

  const counts = useMemo(() => {
    const c = { yellow: 0, red: 0, clean: 0 };
    (rows ?? []).forEach((r) => {
      if (r.fullDays >= RED_AT) c.red += 1;
      else if (r.fullDays >= YELLOW_AT) c.yellow += 1;
      if (r.fullDays === 0 && r.partialDays === 0) c.clean += 1;
    });
    return c;
  }, [rows]);

  const headers = view === "over"
    ? ["م", "رقم الهوية", "اسم الطالب", "الفصل", "أيام غياب كاملة", "أيام غياب جزئي", "الحالة"]
    : ["م", "رقم الهوية", "اسم الطالب", "الفصل", "أيام غياب كاملة", "أيام غياب جزئي", "أيام حضور"];

  const table = () =>
    filtered.map((r, i) =>
      view === "over"
        ? [i + 1, r.national_id, r.name, r.class_no, r.fullDays, r.partialDays,
           r.fullDays >= RED_AT ? "تجاوز 15 يومًا" : "تجاوز 10 أيام"]
        : [i + 1, r.national_id, r.name, r.class_no, r.fullDays, r.partialDays, r.presentDays]
    );

  return (
    <div className="space-y-4">
      <p className="rounded-card border border-[#CCF2DB] bg-mint-tint px-4 py-3 text-sm leading-relaxed text-mint-deep">
        يوم الغياب الكامل هو يوم غاب فيه الطالب عن جميع حصصه المسجّلة. والغياب الجزئي
        يعني غيابه عن بعض الحصص دون بعض.
      </p>

      <p className="rounded-sm2 bg-gray-tint px-3.5 py-2.5 text-xs leading-relaxed text-muted">
        لمتابعة اليوم الحالي لحظيًا — الحضور الرسمي، الطلاب المفقودون، والتأخر
        الصباحي — راجع قسم{" "}
        <a href="/attendance-overview" className="font-semibold text-mint-deep hover:underline">
          «الحضور والغياب»
        </a>{" "}
        في القائمة الجانبية.
      </p>

      <div className="flex flex-wrap gap-1.5">
        <Pill on={view === "over"} onClick={() => setView("over")}>
          المتجاوزون <span className="num">({counts.yellow + counts.red})</span>
        </Pill>
        <Pill on={view === "best"} onClick={() => setView("best")}>
          التميز السلوكي
        </Pill>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">من</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
               className="rounded-sm2 border border-line px-3 py-2 text-sm" />
        <label className="text-sm text-muted">إلى</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
               className="rounded-sm2 border border-line px-3 py-2 text-sm" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Pill on={!grade} onClick={() => setGrade(0)}>كل الصفوف</Pill>
        {[1, 2, 3].map((g) => (
          <Pill key={g} on={grade === g} onClick={() => setGrade(g)}>{GRADE_NAMES[g]}</Pill>
        ))}
      </div>

      {rows && view === "over" && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-card border border-line bg-white px-4 py-3 text-center">
            <p className="num text-2xl font-bold leading-none text-absent">{counts.red}</p>
            <p className="mt-1.5 text-xs text-muted">تجاوز 15 يومًا</p>
          </div>
          <div className="rounded-card border border-line bg-white px-4 py-3 text-center">
            <p className="num text-2xl font-bold leading-none text-late">{counts.yellow}</p>
            <p className="mt-1.5 text-xs text-muted">تجاوز 10 أيام</p>
          </div>
          <div className="rounded-card border border-line bg-white px-4 py-3 text-center">
            <p className="num text-2xl font-bold leading-none text-present">{counts.clean}</p>
            <p className="mt-1.5 text-xs text-muted">سجل نظيف</p>
          </div>
        </div>
      )}

      <ExportBar
        disabled={!filtered.length}
        onExcel={() =>
          exportStyledExcel({
            title: view === "over"
              ? "الطلاب المتجاوزون لحد الغياب"
              : "مرشحو جائزة التميز السلوكي",
            subtitle: `${from} — ${to}`,
            headers,
            rows: table(),
            fileName: view === "over"
              ? `المتجاوزون-${from}_${to}`
              : `التميز-السلوكي-${from}_${to}`,
            sheetName: view === "over" ? "المتجاوزون" : "التميز",
            signatures: SIGNS,
          })}
        onPrint={() =>
          printReport({
            title: view === "over"
              ? "الطلاب المتجاوزون لحد الغياب"
              : "مرشحو جائزة التميز السلوكي",
            subtitle: `${from} — ${to}`,
            headers, rows: table(), ...logos(),
          })}
      />

      {!rows && <p className="text-sm text-muted">جارٍ التحميل…</p>}

      {rows && filtered.length === 0 ? (
        <Empty
          title={view === "over" ? "لا متجاوزين" : "لا بيانات كافية"}
          body={view === "over"
            ? "لا يوجد طلاب تجاوزوا 10 أيام غياب في هذه الفترة."
            : "لا توجد سجلات حضور كافية لترشيح الطلاب."} />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {filtered.slice(0, 300).map((r, i) => {
            const red = r.fullDays >= RED_AT;
            const yellow = !red && r.fullDays >= YELLOW_AT;
            return (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {view === "best" && (
                    <span className="num w-7 shrink-0 text-center text-sm font-bold text-faint">
                      {i + 1}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{r.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      فصل <span className="num">{r.class_no}</span> ·{" "}
                      <span className="num">{r.national_id}</span>
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={`num chip ${
                    red ? "bg-absent/10 font-semibold text-absent"
                    : yellow ? "bg-late/10 font-semibold text-late"
                    : "bg-present/10 text-present"}`}>
                    {r.fullDays} يوم كامل
                  </span>
                  {r.partialDays > 0 && (
                    <span className="num chip bg-gray-tint text-muted">
                      {r.partialDays} جزئي
                    </span>
                  )}
                </div>
              </div>
            );
          })}
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
