import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { todayISO, todayLabel, todayDow } from "../../lib/schoolTime";

const TERM_LABEL = { 1: "الأول", 2: "الثاني" };
import ColorLegend from "../../components/ColorLegend.jsx";
import { printReport, exportStyledExcel, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";
import { fmtDateTime } from "../../lib/dates";

const SHORTCUTS = [
  { to: "/students",    title: "الطلاب",     body: "البحث والفلترة والتقارير" },
  { to: "/reports",     title: "التقارير",   body: "الحضور والغياب والتصدير" },
  { to: "/permissions", title: "الاستئذان",  body: "رفع استئذان داخلي" },
  { to: "/accounts",    title: "الحسابات",   body: "إنشاء حسابات الدخول" },
  { to: "/staff",       title: "الإدارة",    body: "أعضاء الإدارة وأدوارهم" },
  { to: "/import",      title: "الاستيراد",  body: "بيانات نور والجدول" },
  { to: "/season",      title: "التوقيت الزمني", body: "الصيفي والشتوي ومهلة التأخر" },
  { to: "/password-reset", title: "استعادة كلمة المرور", body: "إعادة تعيين لأي مستخدم" },
  { to: "/news-admin",  title: "الأخبار",    body: "نشر أخبار المدرسة" },
  { to: "/guides-admin", title: "الأدلة",    body: "رفع أدلة الاستخدام" },
  { to: "/notifications", title: "الإشعارات", body: "إرسال التعاميم والتنبيهات" },
  { to: "/feedback-admin", title: "الملاحظات", body: "ملاحظات المستخدمين على النسخة التجريبية" },
];

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [openPeriod, setOpenPeriod] = useState(null);
  const date = todayISO();
  const dow = todayDow();

  useEffect(() => {
    (async () => {
      const { data: st } = await supabase.from("settings")
        .select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      const year = m.active_year ?? "";
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
        year, term,
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
          العام <span className="num">{d.year}</span> · الفصل الدراسي {TERM_LABEL[d.term] ?? d.term}
        </p>
      </header>

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

      {d.schedCount > 0 && (
        <UnmarkedByPeriod d={d} open={openPeriod} setOpen={setOpenPeriod} dayLabel={todayLabel()} />
      )}

      {/* أرقام المدرسة */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fig label="طالب"    value={d.students}  to="/students" />
        <Fig label="ولي أمر" value={d.guardians} />
        <Fig label="معلم"    value={d.teachers} />
        <Fig label="فصل"     value={d.classes} />
      </section>

      {/* اختصارات الأقسام */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">الأقسام</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="rounded-card border border-line bg-white p-4 transition-colors hover:border-[#CCF2DB] hover:bg-mint-tint/40"
            >
              <p className="text-sm font-bold text-mint-deep">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{s.body}</p>
            </Link>
          ))}
        </div>
      </section>

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

/* حصص اليوم مجمّعة حسب رقم الحصة */
function UnmarkedByPeriod({ d, open, setOpen, dayLabel }) {
  // تجميع غير المحضَّر حسب رقم الحصة
  const byPeriod = {};
  d.unmarked.forEach((s) => {
    (byPeriod[s.period_no] ??= []).push(s);
  });

  // إجمالي حصص اليوم لكل رقم حصة (لمعرفة المكتمل)
  const totalByPeriod = {};
  (d.periodTotals ?? []).forEach((p) => { totalByPeriod[p.period_no] = p.total; });

  const periods = [...new Set([
    ...Object.keys(byPeriod).map(Number),
    ...Object.keys(totalByPeriod).map(Number),
  ])].sort((a, b) => a - b);

  if (!periods.length) return null;

  const rows = open != null ? (byPeriod[open] ?? []) : [];

  const marked = d.schedCount - d.unmarked.length;
  const pct = d.schedCount ? Math.round((marked / d.schedCount) * 100) : 0;

  const buildRows = (onlyPeriod = null) => {
    const list = onlyPeriod != null ? [onlyPeriod] : periods;
    const out = [];
    list
      .filter((n) => (byPeriod[n] ?? []).length > 0)
      .forEach((n) => {
        byPeriod[n]
          .slice()
          .sort((a, b) => (a.classes?.class_no ?? 0) - (b.classes?.class_no ?? 0))
          .forEach((s) => {
            out.push([
              out.length + 1, n,
              s.classes?.class_no ?? "",
              s.subjects?.name ?? "",
              s.teachers?.full_name ?? "",
            ]);
          });
      });
    return out;
  };

  const excelIt = (onlyPeriod = null) => {
    const all = buildRows(onlyPeriod);
    if (!all.length) return;
    const isPeriod = onlyPeriod != null;

    exportStyledExcel({
      title: isPeriod ? `لم تُحضَّر — الحصة ${onlyPeriod}` : "الحصص التي لم تُحضَّر",
      subtitle: isPeriod
        ? `${dayLabel} · ${all.length} فصل`
        : `${dayLabel} · المحضَّر ${marked} من ${d.schedCount} (${pct}%)`,
      headers: isPeriod
        ? ["م", "الفصل", "المادة", "المعلم"]
        : ["م", "الحصة", "الفصل", "المادة", "المعلم"],
      rows: isPeriod ? all.map((r, i) => [i + 1, r[2], r[3], r[4]]) : all,
      fileName: isPeriod ? `لم-تحضر-حصة-${onlyPeriod}` : "الحصص-غير-المحضرة",
      sheetName: "الحصص",
      signatures: [
        { title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
    });
  };

  const printIt = (onlyPeriod = null) => {
    const list = onlyPeriod != null ? [onlyPeriod] : periods;
    const tableRows = [];

    list
      .filter((n) => (byPeriod[n] ?? []).length > 0)
      .forEach((n) => {
        byPeriod[n]
          .slice()
          .sort((a, b) => (a.classes?.class_no ?? 0) - (b.classes?.class_no ?? 0))
          .forEach((s) => {
            tableRows.push([
              tableRows.length + 1,
              n,
              s.classes?.class_no ?? "",
              s.subjects?.name ?? "",
              s.teachers?.full_name ?? "",
            ]);
          });
      });

    if (!tableRows.length) return;

    const isPeriod = onlyPeriod != null;
    const headers = isPeriod
      ? ["م", "الفصل", "المادة", "المعلم"]
      : ["م", "الحصة", "الفصل", "المادة", "المعلم"];

    // تقرير الحصة لا يحتاج عمود رقم الحصة
    const rows = isPeriod
      ? tableRows.map((r, i) => [i + 1, r[2], r[3], r[4]])
      : tableRows;

    printReport({
      title: isPeriod
        ? `لم تُحضَّر — الحصة ${onlyPeriod}`
        : "الحصص التي لم تُحضَّر",
      subtitle: isPeriod
        ? `${dayLabel} · ${tableRows.length} فصل`
        : `${dayLabel} · المحضَّر ${marked} من ${d.schedCount} (${pct}%)`,
      headers,
      rows,
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      secondSignature: { title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME },
      hideSignatureLine: true,
    });
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">حصص اليوم</h2>
        {d.unmarked.length > 0 ? (
          <span className="text-xs text-muted">
            <span className="num font-semibold text-late">{d.unmarked.length}</span> حصة لم تُحضَّر
          </span>
        ) : (
          <span className="text-xs font-medium text-present">اكتمل التحضير</span>
        )}
      </div>

      {d.unmarked.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
          <button onClick={() => printIt()}
            className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas">
            تقرير اليوم — PDF
          </button>
          <button onClick={() => excelIt()}
            className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas">
            تقرير اليوم — Excel
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 px-4 py-4">
        {periods.map((n) => {
          const left = (byPeriod[n] ?? []).length;
          const done = left === 0;
          const on = open === n;
          return (
            <button
              key={n}
              onClick={() => setOpen(on ? null : n)}
              disabled={done}
              className={`relative flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-card border transition-colors ${
                done
                  ? "border-present/30 bg-present/10 text-present"
                  : on
                  ? "border-mint-deep bg-mint-tint text-mint-deep"
                  : "border-line bg-white text-ink hover:border-[#CCF2DB] hover:bg-canvas"
              }`}
            >
              <span className="num text-lg font-bold leading-none">{n}</span>
              <span className="mt-0.5 text-[10px] leading-none text-muted">الحصة</span>

              {!done && (
                <span className="num absolute -top-1.5 -left-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-late px-1 text-[10px] font-bold text-white">
                  {left}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {open != null && rows.length > 0 && (
        <div className="border-t border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-tint px-4 py-2">
            <p className="text-xs font-medium text-muted">
              لم تُحضَّر في الحصة <span className="num">{open}</span> ·{" "}
              <span className="num">{rows.length}</span> فصل
            </p>
            <div className="flex gap-1.5">
              <button onClick={() => printIt(open)}
                className="rounded-sm2 border border-line bg-white px-3 py-1 text-xs font-medium text-ink hover:bg-canvas">
                PDF
              </button>
              <button onClick={() => excelIt(open)}
                className="rounded-sm2 border border-line bg-white px-3 py-1 text-xs font-medium text-ink hover:bg-canvas">
                Excel
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-auto">
            {rows.map((s) => (
              <div key={s.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
                <span className="num w-10 shrink-0 rounded-md bg-mint-tint py-1 text-center text-xs font-bold text-mint-deep">
                  {s.classes?.class_no}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {s.teachers?.full_name ?? "—"}
                  </p>
                  <p className="truncate text-xs text-muted">{s.subjects?.name ?? "—"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
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
