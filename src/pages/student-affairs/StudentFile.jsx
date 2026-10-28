/* =====================================================================
   ملف الطالب الشامل — واجهة الطالب أمام الإدارة: الهوية، ثم ثمانية مؤشرات ملونة
   تكشف الخلل بنظرة، ونقاط تحتاج انتباهًا، ثم أقسام المواظبة والسلوك والإحالات
   والتحصيل والإنجازات والتواصل، وسجل زمني موحّد. البيانات من ثلاث دوال
   (supabase/student_file_1..3.sql) لمن يحق له الملف: المدير ووكيل شؤون الطلاب
   والدعم الفني وموجّه صف الطالب. الحدود والحالات في studentFileModel.js.
   ===================================================================== */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { todayISO, GRADE_NAMES } from "../../lib/schoolTime";
import { fmtDate, fmtGreg, fmtHijri } from "../../lib/dates";
import { printReport, escHtml } from "../../lib/exportUtils";
import { fetchAllPaged } from "../../lib/attendanceHelpers";
import { loadRangeStart, WARNING_STAGES } from "../../lib/officialAttendance";
import { SIGNS, logos, DateInput, Note, Loading, weekdayOf, useFingerprint } from "./shared.jsx";
import { useSession } from "../../lib/session.jsx";
import { byName } from "../../lib/sortAr.js";
import { Icon } from "../../components/Layout.jsx";
import { FORM_KINDS } from "../../components/BehaviorSheet.jsx";
import { STATUS as REF_STATUS } from "../../lib/referrals.js";
import { levelLabel } from "../../lib/guidanceInquiry.js";
import { NOTE_KINDS } from "../../lib/studentNotes.js";
import { TONE, buildModel, actionLabel } from "./studentFileModel.js";
import PeriodNoticeCard from "../../components/PeriodNoticeCard.jsx";

// من يعدّل حضور الحصص (supabase/class_attendance_staff_edit.sql)
const EDIT_ROLES = ["principal", "tech_support", "deputy_students"];

const STAGE = Object.fromEntries(WARNING_STAGES.map((s) => [s.key, s]));
const day = (d) => (d ? fmtDate(String(d).slice(0, 10) + "T12:00:00") : "—");
const SCHOOL_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

export default function StudentFile() {
  const { adminRoles } = useSession();
  // الموجه يرى طلاب صفه وحده؛ المدير والوكيل والدعم الفني كل الصفوف (مطابق لـ guidance_can)
  const seesAll = (adminRoles ?? []).some((r) => EDIT_ROLES.includes(r));
  const myGrades = [1, 2, 3].filter((g) => seesAll || (adminRoles ?? []).includes(`counselor_${g}`));
  const [all, setAll] = useState(null);
  // ?id=… من رابط اسم الطالب في الإحالات والإنذارات ونماذج السلوك والتوجيه
  const [params] = useSearchParams();
  const linkedId = params.get("id");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(null);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(todayISO());

  useEffect(() => {
    loadRangeStart(todayISO()).then((d) => setFrom(d ?? todayISO().slice(0, 8) + "01"));
    fetchAllPaged(() => supabase.from("v_active_students")
      .select("student_id, full_name, class_no, grade").order("student_id", { ascending: true }))
      .then((r) => setAll(r.filter((s) => myGrades.includes(s.grade)).sort(byName()))).catch(() => setAll([]));
  }, [myGrades.join()]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const s = linkedId && all?.find((x) => x.student_id === linkedId);
    if (s) { setPicked(s); setQ(s.full_name); }
  }, [linkedId, all]);
  const linkedMissing = linkedId && all && !all.some((x) => x.student_id === linkedId);

  const matches = useMemo(() => {
    const t = q.trim();
    if (t.length < 2 || !all) return [];
    return all.filter((s) => s.full_name?.includes(t)).slice(0, 12);
  }, [q, all]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">ملف الطالب</h1>
        <p className="text-sm text-muted">كل ما يتعلق بالطالب في صفحة واحدة، بمؤشرات تكشف ما يحتاج متابعة بنظرة.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <input value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }}
            placeholder="ابحث باسم الطالب…"
            className="w-full rounded-sm2 border border-line px-4 py-2.5 text-sm" />
          {!picked && matches.length > 0 && (
            <div className="card absolute inset-x-0 top-full z-10 mt-1 divide-y divide-line overflow-hidden">
              {matches.map((s) => (
                <button key={s.student_id} onClick={() => { setPicked(s); setQ(s.full_name); }}
                  className="block w-full px-4 py-2 text-right text-sm hover:bg-canvas">
                  {s.full_name} <span className="text-xs text-muted">· صف {s.grade} · فصل {s.class_no}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {from && <>
          <DateInput label="من" value={from} onChange={setFrom} />
          <DateInput label="إلى" value={to} onChange={setTo} />
        </>}
      </div>

      {linkedMissing && !picked && <Note tone="warn">هذا الطالب ليس ضمن الطلاب المتاح لك فتح ملفاتهم.</Note>}
      {!picked ? <Note>اختر طالبًا لعرض ملفه الشامل: المواظبة والسلوك والإحالات والتحصيل والإنجازات والتواصل مع ولي أمره، في الفترة المختارة (الفصل الدراسي الحالي افتراضيًا).</Note>
        : from && <FileBody s={picked} from={from} to={to} />}
    </div>
  );
}

function FileBody({ s, from, to }) {
  const [data, setData] = useState(null);
  const fp = useFingerprint();
  const { can } = useSession();

  useEffect(() => {
    let live = true;
    setData(null);
    const args = { p_student: s.student_id, p_from: from, p_to: to };
    Promise.all(["student_file_attendance", "student_file_conduct", "student_file_academic", "student_file_guardian"]
      .map((f) => supabase.rpc(f, args))).then(([a, c, k, g]) => {
        if (!live) return;
        const err = a.error ?? c.error ?? k.error;
        // تواصل ولي الأمر عبر البوابة (student_file_4.sql)؛ قبل تشغيله يبقى null
        setData(err ? { err } : { att: a.data, con: c.data, aca: k.data, gd: g.error ? null : g.data });
      });
    return () => { live = false; };
  }, [s, from, to]);

  const m = useMemo(() => data && !data.err ? buildModel(data.att, data.con, data.aca, todayISO()) : null, [data]);

  if (!data) return <Loading />;
  if (data.err) return (
    <Note tone="warn">{/student_file_/.test(data.err.message ?? "")
      ? "الملف الشامل يحتاج تشغيل ملفات supabase/student_file_1.sql ثم 2 ثم 3 في Supabase ← SQL Editor."
      : data.err.message}</Note>
  );

  const st = data.att?.student ?? {};
  const kpis = m.kpis.map((k) => (k.key === "late" && !fp ? { ...k, value: "—", sub: "البصمة مقفلة", tone: "none" } : k));

  return (
    <div className="space-y-4">
      <Header st={st} s={s} m={m} notes={data.con?.notes ?? []}
        onPrint={() => printFile({ s, st, m, data, from, to, fp, kpis })} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => <Kpi key={k.key} k={k} />)}
      </div>

      <Alerts alerts={m.alerts} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Attendance m={m} att={data.att} fp={fp} />
        <Conduct m={m} />
        <Referrals m={m} con={data.con} />
        <Academic m={m} aca={data.aca} />
        <Achievements m={m} aca={data.aca} scout={st.scout} />
        <Contact gd={data.gd} st={st} />
      </div>

      {/* إشعار الفترة من نور كما يراه الطالب، ومعه المجموع والنسبة للإدارة */}
      <PeriodNoticeCard studentId={s.student_id} staff />

      {/* التعديل في مركز تصحيح الحضور وحده (المكان الرسمي)، مع إعادة احتساب اليوم */}
      {can("attendance_fix") && (
        <Link to={`/student-affairs?tab=fix&sid=${s.student_id}`}
              className="card flex items-center justify-between gap-2 p-4 text-sm font-semibold text-ink hover:bg-canvas">
          <span className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-sm2 bg-mint-tint text-mint-deep"><Icon name="edit" className="h-4 w-4" /></span>
            تصحيح حضور الطالب
          </span>
          <span className="text-xs text-mint-deep">مركز تصحيح الحضور ←</span>
        </Link>
      )}

      <Timeline items={m.timeline} />
    </div>
  );
}

/* ——— الترويسة: بطاقة الطالب ومؤشر الحالة العام ——— */
function Header({ st, s, m, notes, onPrint }) {
  const g = st.guardian;
  const health = notes.filter((n) => n.kind === "health");
  const badges = [
    st.dropout && st.dropout.status !== "returned" && { t: "منقطع", c: "bg-absent/10 text-absent" },
    m.openRefs.length > 0 && { t: `إحالة مفتوحة (${m.openRefs.length})`, c: "bg-absent/10 text-absent" },
    m.warnings.length > 0 && { t: STAGE[m.warnings.at(-1).stage]?.label ?? "إنذار", c: "bg-late/10 text-late" },
    health.length > 0 && { t: "ملاحظة صحية", c: "bg-excused/10 text-excused" },
    st.scout && { t: "عضو الفريق الكشفي", c: "bg-mint-tint text-mint-deep" },
  ].filter(Boolean);
  return (
    <section className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {/* رمز الطالب: قبعة تخرج فوق شخص */}
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-card bg-mint-deep text-white" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 3 7l9 4 9-4-9-4Z" /><path d="M7 9v3.2c0 1.2 2.2 2.3 5 2.3s5-1.1 5-2.3V9" /><path d="M21 7v4" />
            <path d="M5.5 21c.9-2.6 3.5-4.2 6.5-4.2s5.6 1.6 6.5 4.2" />
          </svg>
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-bold leading-snug text-ink">{st.full_name ?? s.full_name}</h2>
          <p className="text-xs text-muted">
            {GRADE_NAMES[st.grade ?? s.grade] ?? `صف ${s.grade}`} · فصل <span className="num">{st.class_no ?? s.class_no}</span>
            {st.national_id && <> · الهوية <span className="num">{st.national_id}</span></>}
            {st.nationality && <> · {st.nationality}</>}
          </p>
          <p className="text-xs text-muted">
            ولي الأمر: {g ? <>{g.name}{g.relation && ` (${g.relation})`} · {g.mobile
              ? <bdi className="num">{g.mobile}</bdi> : <span className="text-absent">بلا جوال</span>}</> : <span className="text-absent">غير مسجّل</span>}
          </p>
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {badges.map((b) => <span key={b.t} className={`rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ${b.c}`}>{b.t}</span>)}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 sm:flex-col sm:items-center sm:gap-2">
        <Ring score={m.score} tone={m.overall} />
        <button onClick={onPrint}
          className="rounded-sm2 border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas">
          طباعة الملف
        </button>
      </div>
    </section>
  );
}

function Ring({ score, tone }) {
  const T = TONE[tone];
  const r = 30, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center" title="يُحسب من المؤشرات الثمانية: سليم 2، انتباه 1، ملاحظات 0">
      <p className="mb-1 text-[11px] text-muted">مؤشر الحالة</p>
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 72 72" className="h-20 w-20 -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#E6ECE9" strokeWidth="7" />
          <circle cx="36" cy="36" r={r} fill="none" stroke={T.ring} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - (score ?? 0) / 100)} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center leading-tight">
          <div><p className={`num text-lg font-bold ${T.text}`}>{score ?? "—"}</p>
            <p className="text-[9px] text-faint">من 100</p></div>
        </div>
      </div>
      <p className={`mt-1 whitespace-nowrap text-[11px] font-semibold ${T.text}`}>{T.long}</p>
    </div>
  );
}

/* ——— بطاقة مؤشر: متساوية، شريط لوني بحالتها ——— */
function Kpi({ k }) {
  const T = TONE[k.tone];
  return (
    <div className="card relative flex h-full flex-col overflow-hidden p-3.5">
      <span className={`absolute inset-x-0 top-0 h-1 ${T.bar}`} />
      <div className="flex items-start justify-between gap-2">
        <span className={`grid h-9 w-9 place-items-center rounded-sm2 ${T.soft} ${T.text}`}><Icon name={k.icon} /></span>
        {T.t && <span className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${T.soft} ${T.text}`}>{T.t}</span>}
      </div>
      <p className={`num mt-2 text-2xl font-bold leading-none ${k.tone === "none" ? "text-muted" : T.text}`}>{k.value}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{k.label}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted">{k.sub}</p>
    </div>
  );
}

function Alerts({ alerts }) {
  const order = { bad: 0, warn: 1, info: 2 };
  const list = [...alerts].sort((a, b) => order[a.tone] - order[b.tone]);
  return (
    <section className="card p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon name="bell" className="h-4 w-4 text-late" /> نقاط تحتاج انتباهًا
      </h3>
      {!list.length ? (
        <p className="flex items-center gap-2 rounded-sm2 bg-present/10 px-3 py-2 text-sm text-present">
          <Icon name="check" className="h-4 w-4" /> لا ملاحظات تستدعي التدخل في هذه الفترة.
        </p>
      ) : (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {list.map((a, i) => (
            <li key={i} className={`flex items-start gap-2 rounded-sm2 px-3 py-2 text-sm ${TONE[a.tone].soft}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE[a.tone].bar}`} />
              <span className="text-ink">{a.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ——— الأقسام ——— */
function Section({ title, icon, children, wide }) {
  return (
    <section className={`card space-y-3 p-4 ${wide ? "lg:col-span-2" : ""}`}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        {icon && <span className="grid h-7 w-7 place-items-center rounded-sm2 bg-mint-tint text-mint-deep"><Icon name={icon} className="h-4 w-4" /></span>}
        {title}
      </h3>
      {children}
    </section>
  );
}
const Sub = ({ children }) => <p className="text-xs font-semibold text-muted">{children}</p>;
const Empty = ({ children }) => <p className="text-sm text-faint">{children}</p>;
const Stat = ({ v, l, c = "text-ink" }) => (
  <div className="rounded-sm2 bg-canvas px-2 py-2 text-center">
    <p className={`num text-lg font-bold leading-none ${c}`}>{v}</p><p className="mt-1 text-[11px] text-muted">{l}</p>
  </div>
);

function Bars({ rows, max, color = "bg-absent", unit = "" }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="space-y-1.5">
      {rows.map(([n, v]) => (
        <div key={n} className="flex items-center gap-2 text-xs">
          <span className="w-24 shrink-0 truncate text-ink" title={n}>{n}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-pill bg-canvas">
            <div className={`h-full rounded-pill ${color}`} style={{ width: `${(100 * v) / top}%` }} />
          </div>
          <span className="num w-8 shrink-0 text-left text-muted">{v}{unit}</span>
        </div>
      ))}
    </div>
  );
}

/* خريطة الحضور: كل أسبوع صف، وكل يوم دراسي خانة بلون حالته */
function Heatmap({ schoolDays, days }) {
  const mark = Object.fromEntries(days.map((d) => [d.d, d]));
  const weeks = [];
  schoolDays.forEach((d) => {
    const dt = new Date(d + "T12:00:00");
    const sun = new Date(dt); sun.setDate(dt.getDate() - dt.getDay());
    const key = sun.toISOString().slice(0, 10);
    let w = weeks.find((x) => x.key === key);
    if (!w) weeks.push(w = { key, cells: Array(5).fill(null) });
    if (dt.getDay() < 5) w.cells[dt.getDay()] = d;
  });
  const cls = (d) => {
    const x = mark[d];
    if (!x) return "bg-present/70";
    if (x.s === "absent") return "bg-absent";
    if (x.s === "excused") return "bg-excused";
    if (x.late > 0) return "bg-late";
    return "bg-present/70";
  };
  const tip = (d) => {
    const x = mark[d];
    return `${weekdayOf(d)} ${day(d)} · ${!x || x.s === "present" ? (x?.late ? `متأخر ${x.late} د` : "حاضر") : x.s === "absent" ? "غائب" : "غائب بعذر"}`;
  };
  if (!weeks.length) return <Empty>لا أيام دراسة معتمدة في الفترة.</Empty>;
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1 overflow-x-auto pb-1">
        <div className="flex shrink-0 flex-col gap-1 pe-1 text-[10px] leading-5 text-faint">
          {SCHOOL_DAYS.map((n) => <span key={n} className="h-5">{n}</span>)}
        </div>
        {weeks.map((w) => (
          <div key={w.key} className="flex shrink-0 flex-col gap-1">
            {w.cells.map((d, i) => <span key={i} title={d ? tip(d) : ""}
              className={`h-5 w-5 rounded-[4px] ${d ? cls(d) : "bg-transparent"}`} />)}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        {[["bg-present/70", "حاضر"], ["bg-late", "متأخر"], ["bg-excused", "غائب بعذر"], ["bg-absent", "غائب"]].map(([c, t]) => (
          <span key={t} className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-[3px] ${c}`} />{t}</span>))}
      </div>
    </div>
  );
}

function Attendance({ m, att, fp }) {
  const weekday = SCHOOL_DAYS.map((d) => [d, m.byWeekday[d] ?? 0]);
  return (
    <Section title="المواظبة" icon="calendar" wide>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat v={m.schoolDays.length} l="أيام دراسية" />
        <Stat v={m.absent.length} l="غياب بلا عذر" c="text-absent" />
        <Stat v={m.excusedDays.length} l="غياب بعذر" c="text-excused" />
        <Stat v={fp ? m.late.length : "—"} l="تأخر صباحي" c="text-late" />
        <Stat v={m.pAbsent.length} l="حصص غياب" c="text-absent" />
        <Stat v={(att?.permissions ?? []).length} l="استئذان" />
      </div>
      <Heatmap schoolDays={m.schoolDays} days={m.days} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Sub>الغياب حسب أيام الأسبوع</Sub>
          {m.absent.length ? <Bars rows={weekday} /> : <Empty>لا غياب بلا عذر.</Empty>}</div>
        <div className="space-y-2"><Sub>غياب الحصص حسب المادة</Sub>
          {m.bySubject.length ? <Bars rows={m.bySubject.slice(0, 6)} color="bg-late" /> : <Empty>لا غياب حصص.</Empty>}</div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Sub>الإنذارات</Sub>
          <div className="flex gap-1.5">
            {WARNING_STAGES.map((w) => {
              const got = m.warnings.find((x) => x.stage === w.key);
              return (
                <span key={w.key} className={`flex-1 rounded-sm2 px-2 py-1.5 text-center text-[11px] ${got ? "bg-absent/10 font-semibold text-absent" : "bg-canvas text-faint"}`}>
                  {w.label}<br /><span className="num">{got ? day(got.on) : `${w.days} أيام`}</span>
                </span>
              );
            })}
          </div>
        </div>
        <div className="space-y-1.5"><Sub>الأعذار والاستئذان</Sub>
          {!(att?.excused ?? []).length && !(att?.permissions ?? []).length ? <Empty>لا أعذار ولا استئذان.</Empty> : (
            <ul className="space-y-1 text-xs text-ink">
              {(att?.excused ?? []).map((e, i) => <li key={"e" + i}>عذر {day(e.from)}{e.to !== e.from && ` — ${day(e.to)}`} · {e.excuse || e.reason || "—"}</li>)}
              {(att?.permissions ?? []).map((p, i) => <li key={"p" + i}>استئذان {day(p.d)}{p.note && ` · ${p.note}`}</li>)}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}

function Conduct({ m }) {
  const items = [
    ...m.behavior.map((b) => ({ d: b.d, t: FORM_KINDS[b.kind]?.short ?? "نموذج سلوك", x: b.type || b.text, deg: b.degree, ack: b.ack, by: b.by, form: true })),
    ...m.actions.map((a) => { const l = actionLabel(a); return { d: a.d, t: l.kind, x: l.text, deg: a.degree, by: a.by }; }),
  ].sort((a, b) => String(b.d).localeCompare(String(a.d)));
  const degs = [1, 2, 3, 4, 5].map((n) => [`الدرجة ${n}`, items.filter((i) => i.deg === n).length]).filter(([, c]) => c);
  return (
    <Section title="السلوك والانضباط" icon="flag">
      <div className="grid grid-cols-3 gap-2">
        <Stat v={m.behavior.length} l="نماذج سلوك" c={m.behavior.length ? "text-late" : "text-present"} />
        <Stat v={m.actions.length} l="إجراءات" />
        <Stat v={m.maxDeg || "—"} l="أعلى درجة" c={m.maxDeg >= 3 ? "text-absent" : "text-ink"} />
      </div>
      {degs.length > 0 && <Bars rows={degs} color="bg-absent" />}
      {!items.length ? <Empty>لا مخالفات ولا إجراءات في الفترة.</Empty> : (
        <ul className="divide-y divide-line/60 text-sm">
          {items.slice(0, 8).map((i, k) => (
            <li key={k} className="py-1.5">
              <p className="text-ink"><b>{i.t}</b>{i.deg ? <span className="text-absent"> · الدرجة {i.deg}</span> : ""}{i.x && ` · ${i.x}`}</p>
              <p className="text-[11px] text-muted"><span className="num">{day(i.d)}</span>{i.by && ` · ${i.by}`}
                {i.form && <span className={i.ack ? "text-present" : "text-late"}> · {i.ack ? "اطّلع ولي الأمر" : "لم يطّلع ولي الأمر"}</span>}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Referrals({ m, con }) {
  const cases = con?.cases ?? [];
  const inq = con?.inquiries ?? [];
  const notes = con?.notes ?? [];
  // تقديرات الاستقصاءات: كم مادة ضعيف/جيد/ممتاز أكاديميًا وسلوكيًا
  const lv = (key) => ["excellent", "good", "weak"].map((k) => [levelLabel(k), inq.flatMap((i) => i.items ?? []).filter((it) => it[key] === k).length]);
  return (
    <Section title="الإحالات والتوجيه" icon="send">
      <div className="grid grid-cols-3 gap-2">
        <Stat v={m.referrals.length} l="إحالات" />
        <Stat v={m.openRefs.length} l="مفتوحة" c={m.openRefs.length ? "text-absent" : "text-present"} />
        <Stat v={cases.length} l="حالات توجيه" />
      </div>
      {!m.referrals.length ? <Empty>لا إحالات في الفترة.</Empty> : (
        <ul className="divide-y divide-line/60 text-sm">
          {m.referrals.map((r, i) => (
            <li key={i} className="flex items-start justify-between gap-2 py-1.5">
              <div className="min-w-0">
                <p className="text-ink">{r.reason || "إحالة"}{r.subject && <span className="text-muted"> · {r.subject}</span>}</p>
                <p className="text-[11px] text-muted"><span className="num">{r.serial}</span> · <span className="num">{day(r.d)}</span>{r.teacher && ` · ${r.teacher}`}</p>
                {(r.close_note || r.counselor_note) && <p className="text-[11px] text-faint">{r.close_note || r.counselor_note}</p>}
              </div>
              <span className={`shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-semibold ${REF_STATUS[r.status]?.c ?? "bg-canvas text-muted"}`}>{REF_STATUS[r.status]?.t ?? r.status}</span>
            </li>
          ))}
        </ul>
      )}
      {cases.length > 0 && <div className="space-y-1"><Sub>حالات التوجيه</Sub>
        {cases.map((c, i) => <p key={i} className="text-xs text-ink">{c.title} · {c.status === "open" ? <span className="text-late">مفتوحة</span> : "مغلقة"} · جلسات <span className="num">{c.sessions}</span>{c.last && <span className="text-muted"> · {c.last}</span>}</p>)}
      </div>}
      {inq.length > 0 && <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Sub>استقصاء المعلمين: التحصيل</Sub><Bars rows={lv("academic")} color="bg-mint-deep" /></div>
        <div className="space-y-1"><Sub>استقصاء المعلمين: السلوك</Sub><Bars rows={lv("behavior")} color="bg-mint-deep" /></div>
      </div>}
      {notes.length > 0 && <div className="space-y-1"><Sub>ملاحظات الموجهين</Sub>
        {notes.map((n, i) => (
          <p key={i} className="text-xs text-ink"><span className={`me-1 rounded-pill border px-1.5 text-[10px] ${NOTE_KINDS[n.kind]?.chip ?? ""}`}>{NOTE_KINDS[n.kind]?.label ?? n.kind}</span>
            {n.body ?? <span className="text-faint">ملاحظة سرية لدى الموجه</span>}</p>
        ))}
      </div>}
    </Section>
  );
}

function Academic({ m, aca }) {
  const r = m.result;
  return (
    <Section title="التحصيل الدراسي" icon="award">
      <div className="grid grid-cols-3 gap-2">
        <Stat v={m.quizAvg == null ? "—" : `${m.quizAvg}%`} l="متوسط اختباراته" c={TONE[m.kpis.find((k) => k.key === "academic").tone].text} />
        <Stat v={m.classAvgPct == null ? "—" : `${m.classAvgPct}%`} l="متوسط فصله" />
        <Stat v={r?.average ?? "—"} l={r ? `معدل نور ${r.year ?? ""}` : "معدل نور"} />
      </div>
      {!m.quizzes.length ? <Empty>لا اختبارات مرصودة في الفترة.</Empty> : (
        <div className="space-y-2">
          <Sub>درجته مقابل متوسط فصله</Sub>
          {m.quizzes.slice(-8).map((q, i) => (
            <div key={i} className="text-xs">
              <p className="mb-0.5 flex justify-between gap-2"><span className="truncate text-ink">{q.title} <span className="text-faint">· {q.subject}</span></span>
                <span className="num shrink-0 text-muted">{q.score}/{q.total}</span></p>
              <div className="relative h-2.5 overflow-hidden rounded-pill bg-canvas">
                <div className={`h-full rounded-pill ${q.pct >= 85 ? "bg-present" : q.pct >= 65 ? "bg-late" : "bg-absent"}`} style={{ width: `${q.pct}%` }} />
                {q.avgPct != null && <span className="absolute top-0 h-full w-0.5 bg-ink" style={{ insetInlineStart: `${q.avgPct}%` }} title={`متوسط الفصل ${q.avgPct}%`} />}
              </div>
            </div>
          ))}
          <p className="flex items-center gap-1 text-[11px] text-faint"><span className="inline-block h-2.5 w-0.5 bg-ink" /> متوسط الفصل</p>
        </div>
      )}
      {r && <p className="text-xs text-ink">نتيجة نور ({r.type ?? "—"} {r.year ?? ""}): المعدل <b className="num">{r.average ?? "—"}</b>
        {r.rank_class && <> · ترتيبه في الفصل <span className="num">{r.rank_class}</span> من <span className="num">{r.class_count}</span></>}
        {r.rank_grade && <> · وفي الصف <span className="num">{r.rank_grade}</span> من <span className="num">{r.grade_count}</span></>}</p>}
      {(aca?.lab || aca?.qudrat) && <div className="grid grid-cols-2 gap-2">
        {aca?.lab && <Stat v={aca.lab.sessions ? `${aca.lab.avg ?? "—"}%` : "—"} l={`المعمل · ${aca.lab.sessions} دروس`} />}
        {aca?.qudrat && <Stat v={aca.qudrat.answers ? `${Math.round((100 * aca.qudrat.correct) / aca.qudrat.answers)}%` : "—"} l={`مركز التدريب · ${aca.qudrat.answers} سؤالًا`} />}
      </div>}
    </Section>
  );
}

function Achievements({ m, aca, scout }) {
  const league = aca?.league ?? [];
  return (
    <Section title="الإنجازات والمشاركات" icon="certificate">
      <div className="grid grid-cols-3 gap-2">
        <Stat v={m.certs.length} l="شهادات" c="text-mint-deep" />
        <Stat v={m.attended.length} l="فعاليات حضرها" c="text-mint-deep" />
        <Stat v={m.leaguePts} l="نقاط الدوري" c="text-mint-deep" />
      </div>
      {scout && <p className="rounded-sm2 bg-mint-tint px-3 py-1.5 text-xs text-mint-deep">عضو في الفريق الكشفي</p>}
      {!m.docs.length && !m.events.length ? <Empty>لا شهادات ولا مشاركات في الفترة.</Empty> : (
        <ul className="divide-y divide-line/60 text-sm">
          {m.docs.map((d, i) => (
            <li key={"d" + i} className="py-1.5"><p className="text-ink">{d.title}</p>
              <p className="text-[11px] text-muted">{d.category === "certificate" ? "شهادة" : "نموذج"} · <span className="num">{day(d.d)}</span>{d.by && ` · ${d.by}`}</p></li>))}
          {m.events.map((e, i) => (
            <li key={"e" + i} className="py-1.5"><p className="text-ink">{e.title}</p>
              <p className="text-[11px] text-muted">{e.category} · <span className="num">{day(e.d)}</span> · {e.attended ? <span className="text-present">حضر</span> : <span className="text-late">لم يحضر</span>}{e.cert && " · شهادة"}</p></li>))}
        </ul>
      )}
      {league.length > 0 && <div className="space-y-1"><Sub>نقاط دوري المواد</Sub>
        <Bars rows={league.map((l) => [l.subject ?? "—", Number(l.points)])} color="bg-mint-deep" /></div>}
    </Section>
  );
}

/* تقييم متابعة ولي الأمر من نسبة رده على ما يحتاج ردًّا أو إقرارًا في البوابة */
function guardianRating(gd) {
  if (!gd) return null;
  const need = gd.items?.length ?? 0;
  const replied = (gd.items ?? []).filter((i) => i.replied).length;
  const rate = need ? Math.round((100 * replied) / need) : null;
  const r = !gd.accounts ? { t: "لا حساب لولي الأمر في البوابة", c: "bg-absent/10 text-absent", bar: "bg-absent" }
    : rate == null ? { t: "لا يوجد ما يحتاج ردًّا في الفترة", c: "bg-canvas text-muted", bar: "bg-faint" }
    : rate >= 80 ? { t: "متابع لابنه", c: "bg-present/10 text-present", bar: "bg-present" }
    : rate >= 50 ? { t: "متابع جزئيًا", c: "bg-late/10 text-late", bar: "bg-late" }
    : { t: "غير متابع", c: "bg-absent/10 text-absent", bar: "bg-absent" };
  return { ...r, need, replied, rate };
}

/* التواصل مع ولي الأمر عن طريق البوابة وحدها (student_file_4.sql) */
function Contact({ gd, st }) {
  if (!gd) {
    return (
      <Section title="التواصل مع ولي الأمر" icon="chat" wide>
        <Empty>تحتاج تشغيل supabase/student_file_4.sql لعرض تواصل ولي الأمر عبر البوابة.</Empty>
      </Section>
    );
  }
  const R = guardianRating(gd);
  const readPct = gd.notif_total ? Math.round((100 * gd.notif_read) / gd.notif_total) : null;
  return (
    <Section title="التواصل مع ولي الأمر عبر البوابة" icon="chat" wide>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`chip text-xs font-semibold ${R.c}`}>{R.t}</span>
        {R.rate != null && <span className="text-xs text-muted">بناءً على ردّه على ما يحتاج ردًّا: <b className="num text-ink">{R.rate}%</b></span>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat v={gd.notif_total} l="إشعارات وصلت" />
        <Stat v={readPct != null ? `${readPct}%` : "—"} l={`قرأها (${gd.notif_read})`} c={readPct != null && readPct < 50 ? "text-late" : "text-ink"} />
        <Stat v={R.need} l="تحتاج ردًّا" />
        <Stat v={R.need ? `${R.replied} (${R.rate}%)` : "—"} l="ردّ عليها" c={R.rate != null && R.rate < 50 ? "text-absent" : R.rate != null && R.rate < 80 ? "text-late" : "text-present"} />
      </div>
      {R.need > 0 && (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-canvas"><div className={`h-full ${R.bar}`} style={{ width: `${R.rate}%` }} /></div>
          <ul className="divide-y divide-line text-sm">
            {gd.items.map((i, k) => (
              <li key={k} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 text-ink">{i.title}</span>
                <span className="num text-[11px] text-muted">{day(String(i.d).slice(0, 10))}</span>
                <span className={`text-[11px] font-semibold ${i.replied ? "text-present" : "text-absent"}`}>{i.replied ? "ردّ ✓" : "لم يرد"}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-[11px] text-faint">
        التواصل عن طريق البوابة وحدها: الإشعارات تصل حساب ولي الأمر{st.guardian?.name ? ` (${st.guardian.name})` : ""}، وما يحتاج ردًّا هو نماذج التعهد والدعوة والإشعار،
        والإحالات، واستفسارات الموجه، والتعاميم التي تطلب الإقرار. التقييم: 80% فأكثر متابع، ومن 50% متابع جزئيًا، ودونها غير متابع.
      </p>
    </Section>
  );
}

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
function Timeline({ items }) {
  const [all, setAll] = useState(false);
  const list = all ? items : items.slice(0, 15);
  // صفوف الجدول مجمّعة بالشهر: صف عنوان لكل شهر ثم أحداثه
  const groups = [];
  list.forEach((e) => {
    const k = e.d.slice(0, 7);
    if (groups.at(-1)?.k !== k) groups.push({ k, rows: [] });
    groups.at(-1).rows.push(e);
  });
  return (
    <Section title="السجل الزمني الموحّد" icon="clock">
      {!items.length ? <Empty>لا أحداث في الفترة.</Empty> : (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-mint-deep text-right text-xs text-white">
                <th className="w-10 px-2 py-2.5 text-center font-semibold">م</th>
                <th className="w-24 px-3 py-2.5 font-semibold">اليوم</th>
                <th className="w-32 px-3 py-2.5 font-semibold">التاريخ</th>
                <th className="w-24 px-3 py-2.5 font-semibold">النوع</th>
                <th className="px-3 py-2.5 font-semibold">البيان</th>
                <th className="w-44 px-3 py-2.5 font-semibold">المادة / الجهة</th>
              </tr>
            </thead>
            {groups.map((g) => {
              const [y, mo] = g.k.split("-");
              return (
                <tbody key={g.k}>
                  <tr className="bg-mint-tint/70">
                    <td colSpan={6} className="px-3 py-1.5 text-xs font-bold text-mint-deep" dir="rtl">
                      {`${MONTHS[Number(mo) - 1]} ${y}`}
                      <span className="ms-2 font-normal text-muted">{`· ${g.rows.length === 1 ? "حدث واحد" : g.rows.length === 2 ? "حدثان" : `${g.rows.length} ${g.rows.length > 10 ? "حدثًا" : "أحداث"}`}`}</span>
                    </td>
                  </tr>
                  {g.rows.map((e, i) => {
                    const n = list.indexOf(e) + 1;
                    return (
                      <tr key={i} className="border-t border-line/70 even:bg-canvas/60 hover:bg-mint-tint/30">
                        <td className="relative px-2 py-2 text-center">
                          <span className={`absolute inset-y-0 start-0 w-1 ${TONE[e.tone].bar}`} />
                          <span className="num text-xs text-faint">{n}</span>
                        </td>
                        <td className="px-3 py-2 text-xs font-medium text-ink">{weekdayOf(e.d)}</td>
                        <td className="px-3 py-2 leading-tight">
                          <span className="num block text-[13px] font-semibold text-ink">{fmtGreg(e.d + "T12:00:00")}</span>
                          <span className="num block text-[10.5px] text-muted">{fmtHijri(e.d + "T12:00:00")}</span>
                        </td>
                        <td className="px-3 py-2"><span className={`inline-block rounded-pill px-2 py-0.5 text-[11px] font-semibold ${TONE[e.tone].soft} ${TONE[e.tone].text}`}>{e.kind}</span></td>
                        <td className="px-3 py-2 text-ink">{e.text}</td>
                        <td className="px-3 py-2 text-xs text-muted">{e.extra || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
      {items.length > 15 && <button onClick={() => setAll(!all)} className="text-xs text-mint-deep underline">
        {all ? "عرض أحدث 15 فقط" : `عرض الكل (${items.length})`}</button>}
    </Section>
  );
}

/* ——— الطباعة: الملف كاملًا بهوية البوابة ——— */
function printFile({ s, st, m, data, from, to, fp, kpis }) {
  const COLOR = { ok: "#2E8B57", warn: "#9A6B12", bad: "#B02A2A", info: "#3E6350", none: "#7A8781" };
  // الملف HTML جاهز (sections.html): كل قيمة من البيانات تُهرَّب (فيه نص أعذار ولي الأمر والمخالفات والإحالات)
  const esc = escHtml;
  const kv = (k, v) => `<tr><th>${k}</th><td>${esc(v ?? "—")}</td></tr>`;
  const tile = (k) => `<div class="stat-tile" style="border-top:3px solid ${COLOR[k.tone]}"><div class="v" style="color:${COLOR[k.tone]}">${esc(k.value)}</div><div class="l">${esc(k.label)}</div><div class="l" style="font-size:9px">${esc(k.sub)}</div></div>`;
  const head = (t, n) => `<p class="sec-h">${t}${n != null ? ` <span class="c">(${n})</span>` : ""}</p>`;
  const table = (hs, rows, cls = "") => `<table class="${cls}"><thead><tr>${hs.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const block = (t, rows, hs, emptyT, cls) => head(t, rows.length) + (rows.length ? table(["م", ...hs], rows, cls) : `<p class="empty">${emptyT}</p>`);
  const g = st.guardian;
  const att = data.att ?? {}, con = data.con ?? {}, aca = data.aca ?? {};

  const html = `
    <table class="kv">
      ${kv("اسم الطالب", st.full_name ?? s.full_name)}${kv("رقم الهوية", st.national_id)}
      ${kv("الصف / الفصل", `${GRADE_NAMES[st.grade ?? s.grade] ?? s.grade} / ${st.class_no ?? s.class_no}`)}
      ${kv("ولي الأمر", g ? `${g.name}${g.mobile ? ` — ${g.mobile}` : ""}` : "غير مسجّل")}
      ${kv("الفترة", `${day(from)} — ${day(to)}`)}
      ${kv("مؤشر الحالة العام", m.score == null ? "—" : `${m.score} من 100 — ${TONE[m.overall].long}`)}
    </table>
    <div class="stat-tiles" style="margin-top:12px">${kpis.map(tile).join("")}</div>
    ${head("نقاط تحتاج انتباهًا", m.alerts.length)}
    ${m.alerts.length ? `<ul>${m.alerts.map((a) => `<li style="color:${COLOR[a.tone]}">${esc(a.text)}</li>`).join("")}</ul>` : `<p class="empty">لا ملاحظات تستدعي التدخل.</p>`}
    ${block("الإنذارات", m.warnings.map((w) => [STAGE[w.stage]?.label ?? w.stage, day(w.on), w.days ?? "—", w.by ?? ""]), ["الإنذار", "التاريخ", "أيام الغياب", "أصدره"], "لا إنذارات.", "danger")}
    ${block("الغياب الرسمي", [...m.absent, ...m.excusedDays].sort((a, b) => a.d.localeCompare(b.d)).map((d) =>
      [`${weekdayOf(d.d)} ${day(d.d)}`, d.s === "absent" ? "غائب بلا عذر" : "غائب بعذر", d.punched ? "بصم ولم يحضر الحصص" : ""]), ["اليوم والتاريخ", "الحالة", "ملاحظة"], "لا غياب رسمي في الفترة.")}
    ${fp ? block("التأخر الصباحي", m.late.map((d) => [`${weekdayOf(d.d)} ${day(d.d)}`, d.late]), ["اليوم والتاريخ", "دقائق التأخر"], "لا تأخر في الفترة.") : ""}
    ${block("غياب الحصص حسب المادة", m.bySubject, ["المادة", "عدد الحصص"], "لا غياب حصص.")}
    ${block("الأعذار والاستئذان", [...(att.excused ?? []).map((e) => ["عذر", `${day(e.from)}${e.to !== e.from ? ` — ${day(e.to)}` : ""}`, e.excuse || e.reason || ""]),
      ...(att.permissions ?? []).map((p) => ["استئذان", day(p.d), p.note ?? ""])], ["النوع", "التاريخ", "التفاصيل"], "لا أعذار ولا استئذان.")}
    ${block("السلوك والانضباط", [...m.behavior.map((b) => [FORM_KINDS[b.kind]?.short ?? "نموذج", b.degree ?? "—", b.type || b.text || "", day(b.d), b.ack ? "اطّلع" : "لم يطّلع"]),
      ...m.actions.map((a) => { const l = actionLabel(a); return [l.kind, a.degree ?? "—", l.text, day(a.d), ""]; })], ["النوع", "الدرجة", "الوصف", "التاريخ", "ولي الأمر"], "لا مخالفات في الفترة.")}
    ${block("الإحالات", m.referrals.map((r) => [r.serial, r.reason ?? "", r.teacher ?? "", day(r.d), REF_STATUS[r.status]?.t ?? r.status]), ["الرقم", "السبب", "المعلم", "التاريخ", "الحالة"], "لا إحالات في الفترة.")}
    ${(con.cases ?? []).length ? block("حالات التوجيه", con.cases.map((c) => [c.title, day(c.opened), c.status === "open" ? "مفتوحة" : "مغلقة", c.sessions, c.last ?? ""]), ["الحالة", "فُتحت", "الوضع", "الجلسات", "آخر توصية"], "") : ""}
    ${block("الاختبارات", m.quizzes.map((q) => [q.title, q.subject ?? "", `${q.score} / ${q.total}`, `${q.pct}%`, q.avgPct != null ? `${q.avgPct}%` : "—"]), ["الاختبار", "المادة", "الدرجة", "النسبة", "متوسط الفصل"], "لا اختبارات مرصودة في الفترة.")}
    ${m.result ? head("نتيجة نور") + `<p>المعدل ${m.result.average ?? "—"}${m.result.rank_class ? ` · ترتيبه في الفصل ${m.result.rank_class} من ${m.result.class_count}` : ""}${m.result.rank_grade ? ` · وفي الصف ${m.result.rank_grade} من ${m.result.grade_count}` : ""}</p>` : ""}
    ${block("الشهادات والنماذج", m.docs.map((d) => [d.title, d.category === "certificate" ? "شهادة" : "نموذج", day(d.d), d.by ?? ""]), ["العنوان", "النوع", "التاريخ", "المُصدِر"], "لا شهادات في الفترة.")}
    ${block("الفعاليات", m.events.map((e) => [e.title, e.category ?? "", day(e.d), e.attended ? "حضر" : "لم يحضر"]), ["الفعالية", "الفئة", "التاريخ", "الحضور"], "لا مشاركات في الفترة.")}
    ${(() => { const R = guardianRating(data.gd); return R ? head("التواصل مع ولي الأمر عبر البوابة") + `<p>${R.t} · إشعارات وصلت: ${data.gd.notif_total} (قرأ ${data.gd.notif_read}) · تحتاج ردًّا: ${R.need} · ردّ: ${R.replied}${R.rate != null ? ` (${R.rate}%)` : ""}</p>` : ""; })()}
    ${aca.league?.length ? block("نقاط دوري المواد", aca.league.map((l) => [l.subject ?? "—", l.points]), ["المادة", "النقاط"], "") : ""}`;

  printReport({
    title: "ملف الطالب الشامل",
    sections: [{ title: "ملف الطالب الشامل", subtitle: `${day(from)} — ${day(to)}`, html }],
    ...logos(), signatures: SIGNS,
  });
}

