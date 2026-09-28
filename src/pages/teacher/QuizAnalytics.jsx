// src/pages/teacher/QuizAnalytics.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import Loader from "../../components/Loader.jsx";
import PrintPortal from "../../components/PrintPortal.jsx";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

/* =====================================================================
   تحليل النتائج — للمعلم وحده، لاختباراته المنفّذة عبر البوابة فقط
   (الورقي، والورقي بتصحيح آلي، والإلكتروني) في المواد المسندة إليه.
   • مؤشرات: الاختبارات، والطلاب، ومتوسط النسبة، ونسبة النجاح، والغياب.
   • رسوم: متوسط كل اختبار، وتوزيع الدرجات، ومقارنة الفصول.
   • تحليل الفقرات لاختبار واحد مصحَّح آليًا: نسبة الإجابة الصحيحة لكل فقرة.
   • المتفوقون ومن يحتاجون دعمًا، وتقرير مطبوع.
   ===================================================================== */

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };
const BAR = "#3E6350";        // لون البيانات: أخضر الهوية
const BAR_SOFT = "#89D7AD";
const FAIL = "#A23B3B";       // حالة «دون النجاح» — تصحبها دائمًا كلمة
const PASS_PCT = 50;

const MODE_LABEL = { paper: "ورقي", omr: "ورقي (تصحيح آلي)", online: "إلكتروني" };
const PERIOD_LABEL = { period1: "الفترة الأولى", period2: "الفترة الثانية", final: "النهائي" };
const BANDS = [
  { k: "f", t: "أقل من 50", min: 0, max: 50, fail: true },
  { k: "d", t: "50 – 59", min: 50, max: 60 },
  { k: "c", t: "60 – 69", min: 60, max: 70 },
  { k: "b", t: "70 – 79", min: 70, max: 80 },
  { k: "a", t: "80 – 89", min: 80, max: 90 },
  { k: "x", t: "90 – 100", min: 90, max: 101 },
];

const pct = (score, total) => (Number(total) > 0 ? (Number(score) / Number(total)) * 100 : 0);
const r1 = (n) => Math.round(n * 10) / 10;
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const clean = (v) => (typeof v === "string" ? v.replace(/^"|"$/g, "") : v);
const classLabel = (c) => (c ? `${GRADE_NAMES[c.grade] ?? ""} — ${c.class_no}` : "—");

/** هل أجاب الطالب الفقرة صحيحًا؟ (للمصحَّح آليًا) — المزاوجة بنسبة أزواجها الصحيحة */
function correctness(q, a) {
  if (a == null) return 0;
  const key = clean(q.answer);
  if (q.kind === "mcq" || q.kind === "truefalse") return String(clean(a)) === String(key) ? 1 : 0;
  if (q.kind === "match") {
    const k = key && typeof key === "object" ? key : {};
    const pairs = Object.keys(k);
    if (!pairs.length || typeof a !== "object") return 0;
    return pairs.filter((p) => String(a[p]) === String(k[p])).length / pairs.length;
  }
  return null;   // الأنماط المكتوبة لا تُحلَّل آليًا
}

export default function QuizAnalytics() {
  const { session, profile } = useSession();
  const uid = session?.user?.id;

  const [data, setData] = useState(null);   // { quizzes, subs, classes, students, questions }
  const [err, setErr] = useState(null);
  const [f, setF] = useState({ period: "", subject: "", classId: "", quizId: "" });
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const { data: st } = await supabase.from("settings")
        .select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));

      // اختبارات المعلم المنفّذة (بدأ رصدها أو أُقفلت) في الفصل الدراسي الحالي
      const { data: qz, error: e1 } = await supabase.from("quizzes")
        .select("id, title, subject_id, subject_name, grade, period, total_marks, exam_date, mode, status, created_at")
        .eq("teacher_id", uid)
        .eq("academic_year", m.active_year ?? "").eq("term", Number(m.active_term ?? 1))
        .in("status", ["marking", "closed"]);
      if (e1) { setErr(e1.message); setData({ quizzes: [], subs: [], classes: {}, students: {}, questions: [] }); return; }
      const ids = (qz ?? []).map((q) => q.id);
      if (!ids.length) { setData({ quizzes: [], subs: [], classes: {}, students: {}, questions: [] }); return; }

      const [{ data: sb }, { data: qs }, { data: lk }] = await Promise.all([
        supabase.from("quiz_submissions").select("quiz_id, class_id, student_id, score, absent, answers").in("quiz_id", ids),
        supabase.from("quiz_questions").select("id, quiz_id, kind, answer, text, marks, sort_order").in("quiz_id", ids),
        supabase.from("quiz_classes").select("quiz_id, class_id, classes(id, class_no, grade)").in("quiz_id", ids),
      ]);
      const classes = {};
      (lk ?? []).forEach((l) => { if (l.classes) classes[l.class_id] = l.classes; });
      const sids = [...new Set((sb ?? []).map((s) => s.student_id))];
      const students = {};
      for (let i = 0; i < sids.length; i += 300) {
        const { data: ps } = await supabase.from("students").select("id, full_name").in("id", sids.slice(i, i + 300));
        (ps ?? []).forEach((p) => { students[p.id] = p.full_name; });
      }
      setData({
        quizzes: (qz ?? []).sort((a, b) => String(a.exam_date ?? a.created_at).localeCompare(String(b.exam_date ?? b.created_at))),
        subs: sb ?? [], classes, students, questions: qs ?? [],
      });
    })();
  }, [uid]);

  // الخيارات المتاحة للتصفية
  const subjects = useMemo(() => {
    const m = new Map();
    (data?.quizzes ?? []).forEach((q) => { if (q.subject_id && !m.has(q.subject_id)) m.set(q.subject_id, q.subject_name ?? ""); });
    return [...m.entries()];
  }, [data]);

  const quizzes = useMemo(() => (data?.quizzes ?? []).filter((q) =>
    (!f.period || q.period === f.period) && (!f.subject || q.subject_id === f.subject)), [data, f.period, f.subject]);

  const classIds = useMemo(() => [...new Set((data?.subs ?? [])
    .filter((s) => quizzes.some((q) => q.id === s.quiz_id)).map((s) => s.class_id))]
    .filter((id) => data?.classes[id])
    .sort((a, b) => (data.classes[a].grade - data.classes[b].grade) || (data.classes[a].class_no - data.classes[b].class_no)),
  [data, quizzes]);

  const scope = useMemo(() => (f.quizId ? quizzes.filter((q) => q.id === f.quizId) : quizzes), [quizzes, f.quizId]);
  const qById = useMemo(() => Object.fromEntries(scope.map((q) => [q.id, q])), [scope]);

  // الدرجات في النطاق المختار (بنسبة مئوية)
  const rows = useMemo(() => (data?.subs ?? [])
    .filter((s) => qById[s.quiz_id] && (!f.classId || s.class_id === f.classId))
    .map((s) => ({ ...s, pct: s.absent || s.score == null ? null : pct(s.score, qById[s.quiz_id].total_marks) })),
  [data, qById, f.classId]);

  const graded = rows.filter((r) => r.pct != null);
  const kpi = {
    quizzes: new Set(rows.map((r) => r.quiz_id)).size,
    students: new Set(graded.map((r) => r.student_id)).size,
    avg: r1(avg(graded.map((r) => r.pct))),
    pass: graded.length ? Math.round((graded.filter((r) => r.pct >= PASS_PCT).length / graded.length) * 100) : 0,
    absent: rows.filter((r) => r.absent).length,
    sheets: graded.length,
  };

  // متوسط كل اختبار
  const perQuiz = scope.map((q) => {
    const g = graded.filter((r) => r.quiz_id === q.id);
    return { id: q.id, label: q.title, sub: `${MODE_LABEL[q.mode ?? "omr"]} · ${q.exam_date ?? ""}`,
             value: g.length ? r1(avg(g.map((r) => r.pct))) : null, n: g.length };
  }).filter((x) => x.value != null);

  // توزيع الدرجات
  const dist = BANDS.map((b) => ({ ...b, n: graded.filter((r) => r.pct >= b.min && r.pct < b.max).length }));

  // مقارنة الفصول
  const perClass = classIds.filter((id) => !f.classId || id === f.classId).map((id) => {
    const g = graded.filter((r) => r.class_id === id);
    return { id, label: classLabel(data.classes[id]), value: g.length ? r1(avg(g.map((r) => r.pct))) : null, n: g.length,
             pass: g.length ? Math.round((g.filter((r) => r.pct >= PASS_PCT).length / g.length) * 100) : 0 };
  }).filter((x) => x.value != null);

  // الطلاب: متوسط كل طالب عبر اختبارات النطاق
  const perStudent = useMemo(() => {
    const m = new Map();
    graded.forEach((r) => {
      const x = m.get(r.student_id) ?? { id: r.student_id, name: data.students[r.student_id] ?? "—", cls: r.class_id, list: [] };
      x.list.push(r.pct); m.set(r.student_id, x);
    });
    return [...m.values()].map((x) => ({ ...x, avg: r1(avg(x.list)) })).sort((a, b) => b.avg - a.avg);
  }, [graded, data]);
  const top = perStudent.slice(0, 5);
  const support = perStudent.filter((s) => s.avg < 60).slice(-8).reverse();

  // تحليل الفقرات: اختبار واحد مصحَّح آليًا
  const one = f.quizId ? qById[f.quizId] : null;
  const items = useMemo(() => {
    if (!one || one.mode === "paper") return [];
    const qs = (data?.questions ?? []).filter((q) => q.quiz_id === one.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const sheets = rows.filter((r) => r.quiz_id === one.id && !r.absent && r.answers);
    if (!sheets.length) return [];
    return qs.map((q, i) => {
      const vals = sheets.map((s) => correctness(q, s.answers?.[q.id])).filter((v) => v != null);
      return { id: q.id, label: `ف${i + 1}`, text: q.text || "—",
               value: vals.length ? Math.round(avg(vals) * 100) : null };
    }).filter((x) => x.value != null);
  }, [one, data, rows]);

  if (!data) return <Loader />;

  const sel = "field py-2 text-sm";
  const nothing = !data.quizzes.length;

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">تحليل النتائج</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            نتائج اختباراتك المنفّذة عبر البوابة في موادك المسندة، للفصل الدراسي الحالي.
          </p>
        </div>
        {!nothing && (
          <button className="btn-ghost shrink-0" disabled={!kpi.sheets}
                  onClick={() => { setPrinting(true); setTimeout(() => { window.print(); setPrinting(false); }, 400); }}>
            طباعة التقرير
          </button>
        )}
      </div>

      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">تعذّر التحميل: {err}</p>}

      {nothing ? (
        <div className="card px-6 py-12 text-center">
          <p className="text-3xl">📊</p>
          <p className="mt-3 text-sm font-semibold text-ink">لا نتائج لتحليلها بعد</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            يظهر التحليل حين تبدأ رصد درجات أحد اختباراتك في «التصحيح والدرجات»،
            أو يسلّم طلابك اختبارًا إلكترونيًا.
          </p>
        </div>
      ) : (
        <>
          {/* التصفية — صف واحد فوق كل الرسوم */}
          <section className="no-print card grid gap-2 p-3 sm:grid-cols-4">
            <select className={sel} value={f.period} onChange={(e) => setF({ ...f, period: e.target.value, quizId: "" })}>
              <option value="">كل الفترات</option>
              <option value="period1">الفترة الأولى</option>
              <option value="period2">الفترة الثانية</option>
            </select>
            <select className={sel} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value, quizId: "", classId: "" })}>
              <option value="">كل المواد</option>
              {subjects.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
            <select className={sel} value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })}>
              <option value="">كل الفصول</option>
              {classIds.map((id) => <option key={id} value={id}>{classLabel(data.classes[id])}</option>)}
            </select>
            <select className={sel} value={f.quizId} onChange={(e) => setF({ ...f, quizId: e.target.value })}>
              <option value="">كل الاختبارات</option>
              {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
            </select>
          </section>

          <Report kpi={kpi} perQuiz={perQuiz} dist={dist} perClass={perClass} items={items}
                  one={one} top={top} support={support} classes={data.classes} graded={graded.length} />
        </>
      )}

      {printing && (
        <PrintPortal id="qa-report" margin="10mm 12mm">
          <div className="bg-white text-ink" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="text-[11px] font-medium leading-[1.8]">
                <div>المملكة العربية السعودية</div><div>وزارة التعليم</div>
                <div>الإدارة العامة للتعليم بمنطقة مكة المكرمة</div>
                <div className="font-bold text-mint-deep">مدرسة مكة الثانوية</div>
              </div>
              <div className="text-center">
                <p className="text-[15px] font-bold">تقرير تحليل نتائج الاختبارات</p>
                <p className="mt-1 text-[11.5px] text-muted">
                  {profile?.full_name ?? ""}
                  {f.subject ? ` · ${subjects.find(([id]) => id === f.subject)?.[1] ?? ""}` : ""}
                  {f.period ? ` · ${PERIOD_LABEL[f.period]}` : ""}
                  {f.classId ? ` · ${classLabel(data.classes[f.classId])}` : ""}
                  {one ? ` · ${one.title}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <img src={moeLogo} alt="" className="h-9 w-auto" /><img src={logoIcon} alt="" className="h-9 w-auto" />
              </div>
            </div>
            <div className="mb-4 mt-2 h-px w-full" style={{ background: BAR, ...INK }} />
            <Report print kpi={kpi} perQuiz={perQuiz} dist={dist} perClass={perClass} items={items}
                    one={one} top={top} support={support} classes={data.classes} graded={graded.length} />
          </div>
        </PrintPortal>
      )}
    </div>
  );
}

/* ------------------------------ التقرير ------------------------------ */
export function Report({ print = false, kpi, perQuiz, dist, perClass, items, one, top, support, classes, graded }) {
  if (!graded) {
    return <p className="card px-4 py-10 text-center text-sm text-muted">لا درجات مرصودة في هذا النطاق.</p>;
  }
  const maxDist = Math.max(1, ...dist.map((d) => d.n));
  const hard = items.filter((x) => x.value < 50);
  return (
    <div className={print ? "space-y-4" : "space-y-4"}>
      {/* المؤشرات */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <Tile label="اختبارات منفّذة" value={kpi.quizzes} />
        <Tile label="طلاب مُختبَرون" value={kpi.students} hint={`${kpi.sheets} ورقة`} />
        <Tile label="متوسط الأداء" value={`${kpi.avg}٪`} hero />
        <Tile label="نسبة النجاح" value={`${kpi.pass}٪`} hint={`النجاح من ${PASS_PCT}٪`} />
        <Tile label="حالات الغياب" value={kpi.absent} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="متوسط كل اختبار" sub="نسبة متوسط الدرجات من الدرجة الكلية">
          <Columns data={perQuiz} unit="٪" max={100} line={PASS_PCT} lineLabel="النجاح" />
        </Panel>

        <Panel title="توزيع الدرجات" sub="عدد أوراق الطلاب في كل فئة من النسبة المئوية">
          <div className="space-y-1.5 pt-1">
            {dist.map((d) => (
              <div key={d.k} className="flex items-center gap-2 text-xs" title={`${d.t}: ${d.n}`}>
                <span className="w-[70px] shrink-0 text-muted" style={{ unicodeBidi: "plaintext" }}>{d.t}</span>
                <div className="h-5 flex-1 rounded-[3px] bg-canvas" style={INK}>
                  <div className="flex h-full items-center rounded-l-[4px] rounded-r-[1px]"
                       style={{ width: `${(d.n / maxDist) * 100}%`, minWidth: d.n ? 3 : 0,
                                background: d.fail ? FAIL : BAR, ...INK }} />
                </div>
                <span className="num w-8 shrink-0 text-ink">{d.n}</span>
              </div>
            ))}
            <p className="pt-1 text-[11px] text-muted">
              <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: FAIL, ...INK }} /> دون النجاح
              <span className="mx-2 text-faint">·</span>
              <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: BAR, ...INK }} /> ناجح
            </p>
          </div>
        </Panel>
      </div>

      {perClass.length > 0 && (
        <Panel title="مقارنة الفصول" sub="متوسط الأداء ونسبة النجاح لكل فصل">
          <HBars data={perClass.map((c) => ({ ...c, note: `نجاح ${c.pass}٪ · ${c.n} ورقة` }))} unit="٪" max={100} line={PASS_PCT} />
        </Panel>
      )}

      {one && (
        <Panel title={`تحليل الفقرات — ${one.title}`}
               sub={one.mode === "paper"
                 ? "الاختبار الورقي يُرصد بمجموعه، فلا تحليل لفقراته."
                 : "نسبة الطلاب الذين أجابوا كل فقرة إجابة صحيحة"}>
          {items.length > 0 && (
            <>
              <HBars data={items.map((x) => ({ ...x, note: x.text }))} unit="٪" max={100} line={PASS_PCT} compact />
              {hard.length > 0 && (
                <p className="mt-3 rounded-sm2 bg-warning-light px-3 py-2 text-xs leading-relaxed text-warning">
                  ⚠ فقرات أجاب عنها أقل من نصف الطلاب إجابة صحيحة: <b className="num">{hard.map((x) => x.label).join("، ")}</b> — تستحق المراجعة أو إعادة الشرح.
                </p>
              )}
            </>
          )}
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="المتفوقون" sub="أعلى متوسط في اختبارات النطاق">
          <StudentList list={top} classes={classes} tone="good" empty="—" />
        </Panel>
        <Panel title="يحتاجون دعمًا" sub="متوسط أقل من 60٪ — الأدنى أولًا">
          <StudentList list={support} classes={classes} tone="low" empty="لا طلاب دون 60٪ — أحسنت 👏" />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------ عناصر العرض ------------------------------ */
function Tile({ label, value, hint, hero }) {
  return (
    <div className={`rounded-card border px-3 py-3 ${hero ? "border-mint-deep bg-mint-tint" : "border-line/60 bg-white"}`}>
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`num mt-1 font-bold ${hero ? "text-2xl text-mint-deep" : "text-xl text-ink"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10.5px] text-faint">{hint}</p>}
    </div>
  );
}

function Panel({ title, sub, children }) {
  return (
    <section className="card p-4" style={{ breakInside: "avoid" }}>
      <p className="text-sm font-bold text-ink">{title}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** أعمدة رأسية لمتوسط كل اختبار، مع خط النجاح وتلميح عند المرور */
function Columns({ data, unit, max, line, lineLabel }) {
  const [hover, setHover] = useState(null);
  if (!data.length) return <p className="py-6 text-center text-xs text-muted">لا بيانات.</p>;
  const H = 150;
  return (
    <div>
      <div className="relative flex items-end gap-2" style={{ height: H + 22 }}>
        {/* خط النجاح */}
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed" style={{ bottom: 22 + (line / max) * H, borderColor: "#A9A9A9" }} />
        {data.map((d, i) => (
          <div key={d.id} className="relative flex min-w-0 flex-1 flex-col items-center justify-end"
               style={{ height: H + 22 }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="num mb-0.5 text-[10.5px] font-semibold text-ink">{d.value}</span>
            <div className="w-full max-w-[38px] rounded-t-[4px]"
                 style={{ height: Math.max(2, (d.value / max) * H), background: hover === i ? BAR_SOFT : BAR, ...INK }} />
            <span className="num mt-1 h-[16px] text-[10px] text-muted">{i + 1}</span>
            {hover === i && (
              <div className="absolute bottom-full z-10 mb-1 w-44 rounded-sm2 bg-ink px-2.5 py-2 text-[11px] leading-relaxed text-white shadow-card">
                <b className="block truncate">{d.label}</b>
                <span className="block text-white/70">{d.sub}</span>
                <span className="num block">المتوسط {d.value}{unit} · {d.n} ورقة</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10.5px] text-faint">الخط المتقطّع: حد {lineLabel} {line}{unit}</p>
      <ol className="mt-2 space-y-0.5 text-[10.5px] text-muted">
        {data.map((d, i) => <li key={d.id} className="truncate"><span className="num font-semibold text-ink">{i + 1}.</span> {d.label}</li>)}
      </ol>
    </div>
  );
}

/** أشرطة أفقية: الفصول أو الفقرات، مع خط النجاح */
function HBars({ data, unit, max, line, compact = false }) {
  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      {data.map((d) => {
        const low = d.value < line;
        return (
          <div key={d.id} className="grid items-center gap-2 text-xs" style={{ gridTemplateColumns: compact ? "34px 1fr 58px" : "132px 1fr 58px" }}
               title={d.note ? `${d.label}: ${d.value}${unit} — ${d.note}` : undefined}>
            <span className="truncate font-medium text-ink">{d.label}</span>
            <div className="relative h-5 rounded-[3px] bg-canvas" style={INK}>
              <div className="h-full rounded-l-[4px] rounded-r-[1px]"
                   style={{ width: `${(d.value / max) * 100}%`, minWidth: 3, background: low ? FAIL : BAR, ...INK }} />
              <div className="absolute inset-y-0 border-r border-dashed" style={{ right: `${(line / max) * 100}%`, borderColor: "#A9A9A9" }} />
              {!compact && d.note && (
                <span className="num absolute inset-y-0 left-2 flex items-center text-[10px] text-muted">{d.note}</span>
              )}
            </div>
            <span className={`num whitespace-nowrap text-left font-semibold ${low ? "text-absent" : "text-ink"}`}>
              {d.value}{unit}{low ? " ▼" : ""}
            </span>
          </div>
        );
      })}
      <p className="pt-1 text-[10.5px] text-faint">الخط المتقطّع: حد النجاح {line}{unit} · ▼ دونه</p>
    </div>
  );
}

function StudentList({ list, classes, tone, empty }) {
  if (!list.length) return <p className="py-4 text-center text-xs text-muted">{empty}</p>;
  return (
    <table className="w-full text-xs">
      <tbody>
        {list.map((s, i) => (
          <tr key={s.id} className="border-b border-line/50 last:border-0">
            <td className="num w-6 py-1.5 text-faint">{i + 1}</td>
            <td className="py-1.5 font-medium text-ink">{s.name}</td>
            <td className="py-1.5 text-muted">{classLabel(classes[s.cls])}</td>
            <td className="num py-1.5 text-muted">{s.list.length} اختبار</td>
            <td className={`num py-1.5 text-left font-bold ${tone === "low" ? "text-absent" : "text-mint-deep"}`}>{s.avg}٪</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

