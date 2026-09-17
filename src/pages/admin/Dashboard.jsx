import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { todayISO, todayLabel, todayDow } from "../../lib/schoolTime";

const TERM_LABEL = { 1: "الأول", 2: "الثاني" };
import ColorLegend from "../../components/ColorLegend.jsx";
import { printReport, exportStyledExcel, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";
import { fmtDateTime } from "../../lib/dates";
import { loadPeriodTimes, currentPeriodNo } from "../../lib/periodTimes";


export default function Dashboard() {
  const [d, setD] = useState(null);
  const date = todayISO();
  const dow = todayDow();

  useEffect(() => {
    (async () => {
      const { data: st } = await supabase.from("settings")
        .select("key, value").in("key", ["active_year", "active_term", "active_year_label"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      const year = m.active_year ?? "";
      const yearLabel = m.active_year_label ?? year;
      const term = Number(m.active_term ?? 1);

      const [students, classes, teachers, guardians, devices, unmatched,
             noDevice, lastImport, todaySched, todayMarked] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("classes").select("id", { count: "exact", head: true }).eq("academic_year", year),
        supabase.from("teachers").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("guardians").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("devices").select("serial_no, label, last_seen"),
        supabase.from("unmatched_logs").select("id", { count: "exact", head: true }).eq("resolved", false),
        supabase.from("v_students_without_device").select("id", { count: "exact", head: true }),
        supabase.from("import_logs").select("import_type, status, started_at")
          .order("started_at", { ascending: false }).limit(1),
        dow
          ? supabase.from("schedule")
              .select("id, period_no, classes(class_no, grade), teachers(full_name), subjects(name)")
              .eq("academic_year", year).eq("term", term).eq("day_of_week", dow)
          : Promise.resolve({ data: [] }),
        supabase.from("class_attendance").select("schedule_id").eq("attend_date", date),
      ]);

      // حالات "بصم ولم يحضر" اليوم
      let escapeCount = 0;
      try {
        const { data: punches } = await supabase
          .from("daily_attendance").select("student_id").eq("attend_date", date);
        const ids = (punches ?? []).map((p) => p.student_id);
        if (ids.length) {
          const { data: abs } = await supabase
            .from("class_attendance")
            .select("student_id")
            .eq("attend_date", date)
            .eq("status", "absent")
            .in("student_id", ids);
          escapeCount = new Set((abs ?? []).map((r) => r.student_id)).size;
        }
      } catch (_) { /* تجاهل */ }

      const doneSet = new Set((todayMarked.data ?? []).map((r) => r.schedule_id));
      const sched = todaySched.data ?? [];
      const unmarked = sched.filter((s) => !doneSet.has(s.id))
        .sort((a, b) => a.period_no - b.period_no);

      // إجمالي الحصص المجدولة لكل رقم حصة
      const totals = {};
      sched.forEach((s) => { totals[s.period_no] = (totals[s.period_no] ?? 0) + 1; });
      const periodTotals = Object.entries(totals)
        .map(([period_no, total]) => ({ period_no: Number(period_no), total }))
        .sort((a, b) => a.period_no - b.period_no);

      setD({
        year, term, yearLabel,
        students: students.count ?? 0,
        classes: classes.count ?? 0,
        teachers: teachers.count ?? 0,
        guardians: guardians.count ?? 0,
        devices: devices.data ?? [],
        unmatched: unmatched.count ?? 0,
        noDevice: noDevice.count ?? 0,
        lastImport: lastImport.data?.[0] ?? null,
        schedCount: sched.length,
        unmarked,
        periodTotals,
        escapeCount,
      });
    })();
  }, [date, dow]);

  if (!d) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  const marked = d.schedCount - d.unmarked.length;
  const pct = d.schedCount ? Math.round((marked / d.schedCount) * 100) : 0;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-ink">{todayLabel()}</h1>
        <p className="mt-0.5 text-sm text-muted">
          العام <span className="num">{d.yearLabel}</span> · الفصل الدراسي {TERM_LABEL[d.term] ?? d.term}
        </p>
      </header>

      {/* أرقام المدرسة */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fig label="طالب"    value={d.students}  to="/students" />
        <Fig label="ولي أمر" value={d.guardians} />
        <Fig label="معلم"    value={d.teachers} />
        <Fig label="فصل"     value={d.classes} />
      </section>

      {dow > 0 && <MissingStudentsBox date={date} />}
      {dow > 0 && <OfficialStatusBox date={date} />}

      {/* تحضير اليوم */}
      {dow ? (
        <section className="rounded-card border border-[#CCF2DB] bg-mint-tint p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#6AA786]">تحضير اليوم</p>
              <p className="mt-1.5 text-3xl font-bold leading-none text-mint-deep">
                <span className="num">{marked}</span>
                <span className="text-lg font-medium text-muted"> / {d.schedCount}</span>
              </p>
              <p className="mt-2 text-xs text-muted">
                {d.unmarked.length === 0
                  ? "اكتمل تحضير جميع الحصص."
                  : `بقيت ${d.unmarked.length} حصة بلا تحضير.`}
              </p>
            </div>
            <p className="num text-4xl font-bold leading-none text-mint-deep">{pct}%</p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-pill bg-white">
            <div className="h-full rounded-pill bg-[#6AA786] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <Link to="/period-attendance"
            className="mt-3 inline-block text-xs font-semibold text-mint-deep hover:underline">
            التفاصيل والإجراءات ←
          </Link>
        </section>
      ) : (
        <section className="rounded-card border border-line bg-white px-5 py-4">
          <p className="text-sm text-muted">لا حصص اليوم — الأسبوع الدراسي من الأحد إلى الخميس.</p>
        </section>
      )}

      {d.escapeCount > 0 && (
        <Link to="/reports"
          className="flex items-center justify-between gap-3 rounded-card border border-absent/30 bg-absent/5 px-5 py-4 transition-colors hover:bg-absent/10">
          <div>
            <p className="text-sm font-bold text-absent">بصم ولم يحضر</p>
            <p className="mt-0.5 text-xs text-muted">
              طلاب دخلوا المدرسة وغابوا عن حصصهم اليوم.
            </p>
          </div>
          <span className="num text-2xl font-bold text-absent">{d.escapeCount}</span>
        </Link>
      )}



      {/* البصمة */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">أجهزة البصمة</h2>
          {d.noDevice > 0 && (
            <span className="chip bg-late/10 text-late">
              <span className="num">{d.noDevice}</span>&nbsp;طالبًا بلا ربط
            </span>
          )}
        </div>
        {d.devices.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">لم تُسجَّل أجهزة بعد.</p>
        ) : (
          d.devices.map((v) => (
            <div key={v.serial_no}
                 className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{v.label ?? v.serial_no}</p>
                <p className="num truncate text-xs text-faint">{v.serial_no}</p>
              </div>
              <span className={`chip shrink-0 ${v.last_seen ? "bg-present/10 text-present" : "bg-warning-light text-warning"}`}>
                {v.last_seen ? fmtDateTime(v.last_seen) : "لم يتصل بعد"}
              </span>
            </div>
          ))
        )}
      </section>

      <ColorLegend
        groups={[
          {
            title: "حصص اليوم",
            items: [
              { color: "bg-late", label: "عدّاد أحمر", note: "عدد الفصول التي لم تُحضَّر في تلك الحصة" },
              { chip: "bg-present/10 text-present", sample: "أخضر", label: "اكتمل تحضير الحصة" },
            ],
          },
          {
            title: "تنبيهات ومتابعة",
            items: [
              { chip: "bg-absent/10 text-absent", sample: "بصم ولم يحضر",
                label: "طلاب دخلوا المدرسة وغابوا عن حصصهم" },
              { chip: "bg-late/10 text-late", sample: "بلا ربط",
                label: "طلاب بلا رقم في جهاز البصمة" },
            ],
          },
          {
            title: "أجهزة البصمة",
            items: [
              { chip: "bg-present/10 text-present", sample: "متصل", label: "الجهاز يعمل ويرسل البيانات" },
              { chip: "bg-warning-light text-warning", sample: "لم يتصل", label: "لم يصل منه أي اتصال بعد" },
            ],
          },
        ]}
      />

      <section className="card px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">آخر استيراد</h2>
        <p className="mt-1 text-sm text-muted">
          {d.lastImport
            ? `${d.lastImport.import_type} — ${fmtDateTime(d.lastImport.started_at)}`
            : "لم يُنفَّذ استيراد بعد."}
        </p>
      </section>
    </div>
  );
}

/* ==================== صندوق الحضور والغياب الرسمي ==================== */

function OfficialStatusBox({ date }) {
  const [ptimes, setPtimes] = useState(null);
  const [nowPeriod, setNowPeriod] = useState(null);
  const [data, setData] = useState(null);

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

  const period2Done = useMemo(() => {
    if (!ptimes) return false;
    const p2 = ptimes.find((r) => r.kind === "period" && r.period_no === 2);
    if (!p2) return false;
    return nowPeriod == null || nowPeriod > 2;
  }, [ptimes, nowPeriod]);

  useEffect(() => {
    if (!period2Done) return;
    (async () => {
      const { data: rows, error } = await supabase.rpc("official_daily_status", { p_date: date });
      if (error) { console.error(error); return; }
      setData(rows ?? []);
    })();
  }, [date, period2Done]);

  if (!period2Done) {
    return (
      <section className="rounded-card border border-line bg-white p-5">
        <p className="text-sm font-semibold text-ink">الحضور والغياب الرسمي</p>
        <p className="mt-1.5 text-xs text-muted">
          يُحتسب اعتمادًا على الحصتين الأولى والثانية، ويظهر هنا بعد انتهائهما.
        </p>
      </section>
    );
  }

  if (!data) {
    return <section className="rounded-card border border-line bg-white p-5">
      <p className="text-sm text-muted">جارٍ حساب الحضور الرسمي…</p>
    </section>;
  }

  const present = data.filter((r) => r.official === "present").length;
  const absent = data.filter((r) => r.official === "absent").length;
  const pending = data.filter((r) => r.official === "pending").length;
  const resolved = present + absent;
  const pct = resolved ? Math.round((present / resolved) * 100) : null;

  return (
    <Link to="/attendance-overview"
      className="block rounded-card border border-[#CCF2DB] bg-mint-tint p-5 transition-colors hover:bg-mint-tint/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#6AA786]">الحضور والغياب الرسمي</p>
          <div className="mt-1.5 flex items-baseline gap-4">
            <p className="text-3xl font-bold leading-none text-mint-deep">
              {pct != null ? <span className="num">{pct}%</span> : "—"}
              <span className="text-sm font-medium text-muted"> حضور</span>
            </p>
            <p className="text-3xl font-bold leading-none text-absent">
              {pct != null ? <span className="num">{100 - pct}%</span> : "—"}
              <span className="text-sm font-medium text-muted"> غياب</span>
            </p>
          </div>
        </div>
        <div className="flex gap-4 text-center">
          <div>
            <p className="num text-xl font-bold text-present">{present}</p>
            <p className="text-[11px] text-muted">حاضر</p>
          </div>
          <div>
            <p className="num text-xl font-bold text-absent">{absent}</p>
            <p className="text-[11px] text-muted">غائب</p>
          </div>
          {pending > 0 && (
            <div>
              <p className="num text-xl font-bold text-warning">{pending}</p>
              <p className="text-[11px] text-muted">لم يتم تحضيره</p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ==================== صندوق الطلاب المفقودين ==================== */
/* حالة طارئة تظهر فورًا — لا تنتظر اكتمال الحصتين الأولى والثانية معًا */

function MissingStudentsBox({ date }) {
  const [rows, setRows] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [timeline, setTimeline] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("missing_students", { p_date: date });
      if (error) { console.error(error); setRows([]); return; }
      setRows(data ?? []);
    })();
  }, [date]);

  const toggleStudent = async (r) => {
    if (openId === r.student_id) { setOpenId(null); return; }
    setOpenId(r.student_id);
    setTimeline(null);
    const { data, error } = await supabase.rpc("student_day_timeline", {
      p_date: date, p_student_id: r.student_id,
    });
    if (error) { console.error(error); setTimeline([]); return; }
    setTimeline(data ?? []);
  };

  if (!rows || rows.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-card border border-absent/30 bg-absent/5">
      <button onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right">
        <div>
          <p className="text-sm font-bold text-absent">طلاب مفقودون خلال اليوم</p>
          <p className="mt-0.5 text-xs text-muted">اضغط لعرض القائمة والتفاصيل</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="num text-2xl font-bold text-absent">{rows.length}</span>
          <svg viewBox="0 0 24 24" fill="none"
               className={`h-4 w-4 text-absent transition-transform ${expanded ? "rotate-180" : ""}`}
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="max-h-80 overflow-y-auto border-t border-absent/15">
          {rows.map((r) => {
            const open = openId === r.student_id;
            return (
              <div key={r.student_id} className="border-b border-absent/10 last:border-0">
                <button onClick={() => toggleStudent(r)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-right hover:bg-absent/5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{r.full_name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      فصل <span className="num">{r.class_no}</span> · آخر حضور ح
                      <span className="num">{r.last_seen_period}</span> · فُقد في ح
                      <span className="num font-semibold text-absent">{r.missing_period}</span>
                    </p>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none"
                       className={`h-3.5 w-3.5 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
                       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {open && (
                  <div className="bg-white px-5 py-3">
                    {!timeline ? (
                      <p className="text-xs text-muted">جارٍ التحميل…</p>
                    ) : (
                      <StudentTimeline rows={timeline} missingPeriod={r.missing_period} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StudentTimeline({ rows, missingPeriod }) {
  const punch = rows[0]?.punch_time;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="chip bg-mint-tint text-mint-deep">البصمة الصباحية</span>
        <span className="num text-muted">
          {punch
            ? new Date(punch).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
            : "لا توجد بصمة مسجّلة"}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {rows.map((p) => {
          const isMissing = p.period_no === missingPeriod;
          const tone =
            p.status === "absent"
              ? "border-absent/40 bg-absent/10 text-absent"
              : p.status === "late"
              ? "border-late/40 bg-late/10 text-late"
              : p.status === "excused"
              ? "border-excused/40 bg-excused/10 text-excused"
              : "border-present/40 bg-present/10 text-present";
          return (
            <span key={p.period_no}
              className={`rounded-sm2 border px-2.5 py-1.5 text-xs ${tone} ${isMissing ? "ring-2 ring-absent" : ""}`}>
              <span className="num font-semibold">ح{p.period_no}</span>
              <span className="mx-1 text-faint">·</span>
              {p.subject ?? "—"}
              {isMissing && <span className="mr-1 font-bold">◀ هنا</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Fig({ label, value, to }) {
  const body = (
    <div className="rounded-card border border-line bg-white px-4 py-4">
      <p className="num text-2xl font-bold leading-none text-mint-deep">{value}</p>
      <p className="mt-1.5 text-xs text-muted">{label}</p>
    </div>
  );
  return to
    ? <Link to={to} className="block transition-colors hover:opacity-80">{body}</Link>
    : body;
}
