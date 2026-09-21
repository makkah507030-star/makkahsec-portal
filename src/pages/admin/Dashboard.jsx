import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession, ADMIN_ROLE_LABEL } from "../../lib/session.jsx";
import { todayISO, todayLabel, todayDow } from "../../lib/schoolTime";

const TERM_LABEL = { 1: "الأول", 2: "الثاني" };

// الحسابات المساندة: لا يظهر لها في لوحة التحكم الرئيسية أي بيانات إطلاقًا
// (لا أرقام مدرسة ولا حضور ولا حصص) — فقط بطاقة ترحيب، وتعمل من القائمة
// الجانبية بحسب الصلاحية الممنوحة لها. المساعد الإداري (clerk) مستثنى.
const SUPPORT_ROLES = [
  "activity_leader",
  "media_portal",
  "gifted_program",
  "globe_program",
  "student_voice",
  "makkah_sport",
  "safety_security",
  "health_counselor",
  "science_labs",
  "computer_lab",
];
import ColorLegend from "../../components/ColorLegend.jsx";
import { printReport, exportStyledExcel, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";
import { fmtDateTime } from "../../lib/dates";
import { loadPeriodTimes, currentPeriodNo } from "../../lib/periodTimes";
import { markedScheduleIds } from "../../lib/attendanceHelpers";
import ExamCountdown from "../../components/ExamCountdown.jsx";


export default function Dashboard() {
  const { can, profile, adminRoles } = useSession();
  // الحساب المساند: كل أدواره ضمن قائمة الحسابات المساندة — يُحجب عنه كل
  // شيء في اللوحة الرئيسية ويرى بطاقة ترحيب فقط. أما من له دور أساسي
  // (مدير/وكيل/موجّه/مساعد إداري) فتُطبَّق عليه القاعدة بحسب صلاحياته.
  const isSupportOnly =
    (adminRoles?.length ?? 0) > 0 && adminRoles.every((r) => SUPPORT_ROLES.includes(r));

  // لوحة التحكم الرئيسية تعرض بيانات حسّاسة (حضور، حصص، طلاب مفقودون).
  // نُظهر كل قسم بحسب صلاحية الحساب فقط.
  const canReports = !isSupportOnly && can("reports");
  const canStudents = !isSupportOnly && can("students");
  const canImport = !isSupportOnly && can("import");
  const canFigures = canReports || canStudents;

  const [d, setD] = useState(null);
  const date = todayISO();
  const dow = todayDow();

  useEffect(() => {
    if (isSupportOnly) { setD({ supportOnly: true }); return; }
    (async () => {
      const { data: st } = await supabase.from("settings")
        .select("key, value").in("key", ["active_year", "active_term", "active_year_label"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      const year = m.active_year ?? "";
      const yearLabel = m.active_year_label ?? year;
      const term = Number(m.active_term ?? 1);

      const base = { year, term, yearLabel };

      // أرقام المدرسة — لمن يملك صلاحية الطلاب أو التقارير
      if (canFigures) {
        const [students, classes, teachers, guardians] = await Promise.all([
          supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("classes").select("id", { count: "exact", head: true }).eq("academic_year", year),
          supabase.from("teachers").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("guardians").select("id", { count: "exact", head: true }).eq("is_active", true),
        ]);
        Object.assign(base, {
          students: students.count ?? 0,
          classes: classes.count ?? 0,
          teachers: teachers.count ?? 0,
          guardians: guardians.count ?? 0,
        });
      }

      // آخر استيراد — لمن يملك صلاحية الاستيراد
      if (canImport) {
        const { data: li } = await supabase.from("import_logs")
          .select("import_type, status, started_at")
          .order("started_at", { ascending: false }).limit(1);
        base.lastImport = li?.[0] ?? null;
      }

      // بيانات الحضور والحصص — لمن يملك صلاحية التقارير فقط
      if (canReports) {
        // كل الطلبات بالتوازي: عدّاد غير المطابَقين، جدول اليوم، ومجموعة
        // الحصص المُحضَّرة (دالة سريعة في القاعدة واحتياطيًا جلب على دفعات).
        const [unmatched, todaySched, markedSet] = await Promise.all([
          supabase.from("unmatched_logs").select("id", { count: "exact", head: true }).eq("resolved", false),
          dow
            ? supabase.from("schedule")
                .select("id, period_no, classes(class_no, grade), teachers(full_name), subjects(name)")
                .eq("academic_year", year).eq("term", term).eq("day_of_week", dow)
            : Promise.resolve({ data: [] }),
          markedScheduleIds(date),
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

        const doneSet = markedSet;
        const sched = todaySched.data ?? [];
        const unmarked = sched.filter((s) => !doneSet.has(s.id))
          .sort((a, b) => a.period_no - b.period_no);

        const totals = {};
        sched.forEach((s) => { totals[s.period_no] = (totals[s.period_no] ?? 0) + 1; });
        const periodTotals = Object.entries(totals)
          .map(([period_no, total]) => ({ period_no: Number(period_no), total }))
          .sort((a, b) => a.period_no - b.period_no);

        Object.assign(base, {
          unmatched: unmatched.count ?? 0,
          schedCount: sched.length,
          unmarked,
          periodTotals,
          escapeCount,
        });
      }

      setD(base);
    })();
  }, [date, dow, canFigures, canReports, canImport, isSupportOnly]);

  if (!d) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  // الحساب المساند: بطاقة ترحيب فقط، بلا أي بيانات
  if (d.supportOnly) {
    const roleNames = (adminRoles ?? [])
      .map((r) => ADMIN_ROLE_LABEL[r] ?? r)
      .join(" · ");
    return (
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-bold text-ink">{todayLabel()}</h1>
        </header>
        <section className="card px-6 py-12 text-center">
          <p className="text-lg font-bold text-ink">
            مرحبًا{profile?.full_name ? `، ${profile.full_name}` : ""}
          </p>
          {roleNames && (
            <p className="mt-1.5 text-sm font-medium text-mint-deep">{roleNames}</p>
          )}
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            اختر مهمتك من القائمة الجانبية. تظهر لك التبويبات المتاحة لحسابك فقط.
          </p>
        </section>
      </div>
    );
  }

  // نتحقق من وجود البيانات فعلًا (d.unmarked) لا من الصلاحية فقط — لأن
  // canReports قد يتحوّل true قبل أن يُعيد الـ effect بناء d (سباق زمني).
  const marked = canReports && d.unmarked ? d.schedCount - d.unmarked.length : 0;
  const pct = canReports && d.schedCount ? Math.round((marked / d.schedCount) * 100) : 0;
  // حساب محدود الصلاحيات لا يملك أيًّا من أقسام اللوحة
  const barren = !canFigures && !canReports && !canImport;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-ink">{todayLabel()}</h1>
        <p className="mt-0.5 text-sm text-muted">
          العام <span className="num">{d.yearLabel}</span>هـ · الفصل الدراسي {TERM_LABEL[d.term] ?? d.term}
        </p>
      </header>

      <ExamCountdown />

      {/* حساب إداري محدود الصلاحيات: ترحيب وتوجيه للقائمة الجانبية */}
      {barren && (
        <section className="card px-6 py-10 text-center">
          <p className="font-semibold text-ink">
            مرحبًا{profile?.full_name ? `، ${profile.full_name}` : ""}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
            اختر مهمتك من القائمة الجانبية. تظهر لك التبويبات المتاحة لحسابك فقط.
          </p>
        </section>
      )}

      {/* أرقام المدرسة */}
      {canFigures && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fig label="طالب"    value={d.students}  to={canStudents ? "/students" : undefined} />
          <Fig label="ولي أمر" value={d.guardians} />
          <Fig label="معلم"    value={d.teachers} />
          <Fig label="فصل"     value={d.classes} />
        </section>
      )}

      {canReports && dow > 0 && <MissingStudentsBox date={date} />}
      {canReports && dow > 0 && <OfficialStatusBox date={date} />}

      {/* تحضير اليوم — لا يُعرض إلا بعد اكتمال تحميل البيانات (d.unmarked) */}
      {canReports && d.unmarked && (dow ? (
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
      ))}

      {canReports && d.escapeCount > 0 && (
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

      {canReports && (
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
          ]}
        />
      )}

      {canImport && (
        <section className="card px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">آخر استيراد</h2>
          <p className="mt-1 text-sm text-muted">
            {d.lastImport
              ? `${d.lastImport.import_type} — ${fmtDateTime(d.lastImport.started_at)}`
              : "لم يُنفَّذ استيراد بعد."}
          </p>
        </section>
      )}
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

const MISSING_ACTIONS = [
  { key: "escaped", label: "هروب من المدرسة", tone: "bg-absent text-white" },
  { key: "parent_permission", label: "استئذان ولي الأمر", tone: "bg-excused text-white" },
  { key: "no_entry", label: "عدم الدخول للحصة", tone: "bg-late text-white" },
];
const ACTION_LABEL = Object.fromEntries(MISSING_ACTIONS.map((a) => [a.key, a.label]));

function MissingStudentsBox({ date }) {
  const { profile } = useSession();
  const [rows, setRows] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [done, setDone] = useState({}); // student_id -> action key
  const [resolved, setResolved] = useState({}); // student_id -> from_period (عاد للفصل)
  const [periodPick, setPeriodPick] = useState(null); // student_id قيد اختيار حصة العودة
  const [ptimes, setPtimes] = useState(null);

  useEffect(() => {
    loadPeriodTimes().then(({ rows }) => setPtimes(rows));
  }, []);

  const reloadNotes = async (ids) => {
    if (!ids.length) return;
    const [{ data: notes }, { data: rets }] = await Promise.all([
      supabase
        .from("admin_missing_notes")
        .select("student_id, action, created_at")
        .eq("note_date", date)
        .in("student_id", ids)
        .order("created_at", { ascending: false }),
      supabase
        .from("permission_returns")
        .select("student_id, from_period")
        .eq("return_date", date)
        .in("student_id", ids),
    ]);
    const map = {};
    (notes ?? []).forEach((n) => { if (!map[n.student_id]) map[n.student_id] = n.action; });
    setDone(map);
    setResolved(Object.fromEntries((rets ?? []).map((r) => [r.student_id, r.from_period])));
  };

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("missing_students", { p_date: date });
      if (error) { console.error(error); setRows([]); return; }
      setRows(data ?? []);

      // حمّل الإجراءات المسجّلة مسبقًا اليوم لهؤلاء الطلاب
      const ids = (data ?? []).map((r) => r.student_id);
      await reloadNotes(ids);
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

  const recordAction = async (studentId, action) => {
    if (!profile?.id) return;
    setBusyId(studentId);

    // سجل الإجراء دائمًا (للأرشيف والعرض عند المعلم)
    const { error: noteErr } = await supabase.from("admin_missing_notes").insert({
      student_id: studentId, note_date: date, action, created_by: profile.id,
    });

    // "هروب" و"استئذان ولي الأمر" يعتبران استئذانًا داخليًا رسميًا —
    // يحوّلان تلقائيًا حالة الطالب لـ"مستأذن" في كل حصصه المتبقية اليوم
    if (!noteErr && (action === "escaped" || action === "parent_permission")) {
      const { data: req, error: reqErr } = await supabase
        .from("permission_requests")
        .insert({
          request_date: date,
          scope: "day",
          note: action === "escaped"
            ? "⚠️ رصدت الإدارة هروبًا من المدرسة"
            : "استئذان ولي الأمر (بقرار إداري)",
          created_by: profile.id,
        })
        .select("id")
        .single();
      if (!reqErr && req) {
        await supabase.from("permission_request_students")
          .insert({ request_id: req.id, student_id: studentId });
      }
    }

    setBusyId(null);
    if (!noteErr) setDone((m) => ({ ...m, [studentId]: action }));
  };

  // معالجة عودة الطالب: عاد للفصل / وُجد بالمدرسة / انتهى استئذانه —
  // ينهي قفل المعلم من الحصة المحددة فما بعدها ويعيد الطالب للتعامل الطبيعي
  const markReturned = async (studentId, fromPeriod) => {
    setBusyId(studentId);
    const { error } = await supabase.from("permission_returns").upsert(
      {
        student_id: studentId,
        return_date: date,
        from_period: fromPeriod,
        returned_by: profile?.id ?? null,
      },
      { onConflict: "student_id,return_date" }
    );
    setBusyId(null);
    setPeriodPick(null);
    if (error) { alert("تعذّر تسجيل عودة الطالب: " + error.message); return; }
    setResolved((m) => ({ ...m, [studentId]: fromPeriod }));
  };

  const undoReturned = async (studentId) => {
    setBusyId(studentId);
    const { error } = await supabase
      .from("permission_returns")
      .delete()
      .eq("student_id", studentId)
      .eq("return_date", date);
    setBusyId(null);
    if (error) { alert("تعذّر التراجع: " + error.message); return; }
    setResolved((m) => { const n = { ...m }; delete n[studentId]; return n; });
  };

  if (!rows || rows.length === 0) return null;

  const currentPeriod = ptimes ? currentPeriodNo(ptimes) : null;

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
                  <div className="space-y-3 bg-white px-5 py-3">
                    {!timeline ? (
                      <p className="text-xs text-muted">جارٍ التحميل…</p>
                    ) : (
                      <StudentTimeline rows={timeline} missingPeriod={r.missing_period} />
                    )}

                    <div className="border-t border-line pt-3">
                      {done[r.student_id] ? (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-mint-deep">
                            ✓ تم تسجيل: {ACTION_LABEL[done[r.student_id]]}
                          </p>

                          {(done[r.student_id] === "escaped" || done[r.student_id] === "parent_permission") && (
                            resolved[r.student_id] != null ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="num chip bg-present/15 text-present">
                                  عاد للفصل من الحصة {resolved[r.student_id]}
                                </span>
                                <button
                                  onClick={() => undoReturned(r.student_id)}
                                  disabled={busyId === r.student_id}
                                  className="shrink-0 text-[11px] font-medium text-absent hover:underline disabled:opacity-50">
                                  تراجع
                                </button>
                              </div>
                            ) : periodPick === r.student_id ? (
                              <div className="border-t border-line pt-2">
                                <p className="text-[11px] text-muted">
                                  من أي حصة يُتابع الطالب حضوره بشكل طبيعي؟
                                </p>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => (
                                    <button key={n}
                                      onClick={() => markReturned(r.student_id, n)}
                                      disabled={busyId === r.student_id}
                                      className={`num rounded-sm2 border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                                        n === currentPeriod
                                          ? "border-present bg-present/10 text-present"
                                          : "border-line text-ink hover:border-present hover:bg-present/10"}`}>
                                      {n}
                                    </button>
                                  ))}
                                </div>
                                <button
                                  onClick={() => setPeriodPick(null)}
                                  className="mt-1.5 text-[11px] font-medium text-muted hover:underline">
                                  إلغاء
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setPeriodPick(r.student_id)}
                                disabled={busyId === r.student_id}
                                className="rounded-pill border border-present/40 bg-present/10 px-3 py-1 text-[11px] font-semibold text-present hover:bg-present/20 disabled:opacity-50">
                                عاد الطالب / تمت معالجته
                              </button>
                            )
                          )}
                        </div>
                      ) : (
                        <>
                          <p className="mb-1.5 text-xs font-medium text-muted">إجراء الإدارة:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {MISSING_ACTIONS.map((a) => (
                              <button key={a.key}
                                disabled={busyId === r.student_id}
                                onClick={() => recordAction(r.student_id, a.key)}
                                className={`rounded-sm2 px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${a.tone}`}>
                                {a.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
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
