import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { todayISO, todayLabel, todayDow } from "../../lib/schoolTime";
import ColorLegend from "../../components/ColorLegend.jsx";
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
  { to: "/feedback-admin", title: "الملاحظات", body: "ملاحظات المستخدمين على النسخة التجريبية" },
];

export default function Dashboard() {
  const [d, setD] = useState(null);
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
          العام <span className="num">{d.year}</span> · الفصل <span className="num">{d.term}</span>
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

      {d.unmarked.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
            حصص لم تُحضَّر <span className="num text-late">({d.unmarked.length})</span>
          </h2>
          <div className="max-h-72 overflow-auto">
            {d.unmarked.map((s) => (
              <div key={s.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
                <span className="num w-8 shrink-0 rounded-md bg-warning-light py-1 text-center text-xs font-bold text-warning">
                  {s.period_no}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.teachers?.full_name ?? "—"}</p>
                  <p className="truncate text-xs text-muted">
                    {s.subjects?.name ?? "—"} · فصل <span className="num">{s.classes?.class_no}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
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
        items={[
          { chip: "bg-warning-light text-warning", sample: "رقم الحصة", label: "حصة لم تُحضَّر" },
          { chip: "bg-present/10 text-present", sample: "متصل", label: "جهاز بصمة يعمل" },
          { chip: "bg-warning-light text-warning", sample: "لم يتصل بعد", label: "جهاز لم يتصل" },
          { chip: "bg-late/10 text-late", sample: "بلا ربط", label: "طلاب بلا رقم بصمة" },
          { chip: "bg-absent/10 text-absent", sample: "بصم ولم يحضر", label: "دخل وغاب عن الحصص" },
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
