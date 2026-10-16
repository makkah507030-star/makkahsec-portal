import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fmtDate } from "../lib/dates";
import { GRADE_NAMES, todayISO } from "../lib/schoolTime";
import { countAr } from "../lib/arabicCount";
import { printReport, PRINCIPAL_NAME } from "../lib/exportUtils";
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";
import EvidenceTags from "./EvidenceTags.jsx";

/* =====================================================================
   دورة الاختبار المتتابعة (التشخيصي واختبارا الفترتين) — مثل مراحل الأحداث:
   بيانات ونوع ← أسئلة ← تطبيق ← تصحيح ← تحليل ← خطة ← تنفيذ ← إغلاق.
   • الخطة العلاجية إلزامية في التشخيصي، وفي اختبار الفترة إن وُجد من يحتاج
     دعمًا (أقل من 60٪). الإثرائية اختيارية للمتفوقين (90٪ فأكثر).
   • تكريم المتفوقين بشهادات البوابة شرط لإغلاق الدورة متى وُجدوا.
   • كل مرحلة منجزة تصل شاهدًا آليًا إلى «شواهد الأداء الوظيفي»
     (perf_auto_counts في supabase/quiz_cycle.sql).
   • التحقق من الأثر (supabase/quiz_verify_*.sql): بعد تنفيذ الخطة العلاجية يُنشأ اختبار
     تحقق لطلابها، ويُقاس الأثر آليًا بعد رصده: نسبة كل طالب قبل الخطة وبعدها. ومن بقي
     دون 60% تلزمه خطة ثانية بدعم أعلى، وما بقي بعدها يصل المدير.
   ===================================================================== */

export const CYCLE_PERIODS = ["diagnostic", "period1", "period2"];
const SUPPORT_PCT = 60;
const EXCEL_PCT = 90;
const KIND_LABEL = { remedial: "الخطة العلاجية", enrichment: "الخطة الإثرائية" };

const STAGES = [
  { key: "data", label: "بيانات الاختبار ونوعه" },
  { key: "questions", label: "بناء الأسئلة" },
  { key: "apply", label: "التطبيق" },
  { key: "mark", label: "التصحيح والرصد" },
  { key: "analysis", label: "التحليل" },
  { key: "plan", label: "الخطة" },
  { key: "execute", label: "التنفيذ والتكريم" },
  { key: "verify", label: "التحقق من الأثر" },
  { key: "close", label: "الإغلاق" },
];

const r1 = (x) => Math.round(x * 10) / 10;

function PlanForm({ q, kind, plan, suggested, onSaved, onCancel, round = 1, parentId = null }) {
  const [picked, setPicked] = useState(() => new Set((plan?.students ?? suggested).map((s) => s.id)));
  const [skills, setSkills] = useState(plan?.skills ?? "");
  const [procedures, setProcedures] = useState(plan?.procedures ?? "");
  const [start, setStart] = useState(plan?.start_date ?? "");
  const [end, setEnd] = useState(plan?.end_date ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pool = useMemo(() => {
    const m = new Map([...(plan?.students ?? []), ...suggested].map((s) => [s.id, s]));
    return [...m.values()];
  }, [plan, suggested]);

  const save = async () => {
    setErr("");
    if (!picked.size) { setErr("اختر طالبًا واحدًا على الأقل."); return; }
    if (!skills.trim()) { setErr("اكتب المهارات المستهدفة."); return; }
    if (!procedures.trim()) { setErr("اكتب الإجراءات والاستراتيجيات."); return; }
    setBusy(true);
    const row = {
      quiz_id: q.id, kind, students: pool.filter((s) => picked.has(s.id)),
      skills: skills.trim(), procedures: procedures.trim(),
      start_date: start || null, end_date: end || null, updated_at: new Date().toISOString(),
      ...(!plan && round > 1 ? { round, parent_id: parentId } : {}),
    };
    const { error } = plan
      ? await supabase.from("quiz_plans").update(row).eq("id", plan.id)
      : await supabase.from("quiz_plans").insert(row);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  };

  return (
    <div className="space-y-3 rounded-sm2 border border-mint-light bg-mint-tint p-3">
      <p className="font-semibold text-mint-deep">{round > 1 ? "الخطة العلاجية الثانية · دعم أعلى" : KIND_LABEL[kind]}</p>
      {round > 1 && (
        <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-xs leading-relaxed text-absent">
          هؤلاء بقوا دون 60% في اختبار التحقق. غيّر الإجراءات واجعل الدعم أقرب: مجموعات أصغر، وزمن أطول،
          وتعلّم بالأقران مع متفوقين، وتواصل مع أولياء أمورهم.
        </p>
      )}
      <div>
        <label className="label">الطلاب المستهدفون</label>
        {pool.length === 0 ? <p className="text-sm text-faint">لا طلاب في هذه الفئة.</p> : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {pool.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-sm2 bg-paper px-2.5 py-1.5 text-sm">
                <input type="checkbox" checked={picked.has(s.id)}
                       onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })} />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="num text-xs text-muted">{s.avg}%</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="label">المهارات المستهدفة</label>
        <textarea className="field min-h-[70px]" value={skills} onChange={(e) => setSkills(e.target.value)}
                  placeholder={kind === "remedial" ? "المهارات المفقودة كما ظهرت في تحليل الفقرات…" : "المهارات التي يُثرى فيها المتفوقون…"} />
      </div>
      <div>
        <label className="label">الإجراءات والاستراتيجيات</label>
        <textarea className="field min-h-[70px]" value={procedures} onChange={(e) => setProcedures(e.target.value)}
                  placeholder="مثل: تعلّم بالأقران، أوراق عمل متدرجة، إعادة شرح في حصة النشاط…" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">بداية التنفيذ</label><input type="date" className="field num" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div><label className="label">نهاية التنفيذ</label><input type="date" className="field num" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-danger">{err}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ الخطة"}</button>
        <button className="btn-ghost" onClick={onCancel} disabled={busy}>إلغاء</button>
      </div>
      <EvidenceTags items={kind === "remedial" ? ["e05_06", "e05_05"] : ["e05_07"]} />
    </div>
  );
}

function PlanCard({ q, plan, teacherName, onEdit, onChanged }) {
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);
  const done = plan.status === "done";

  const markDone = async () => {
    const { error } = await supabase.from("quiz_plans")
      .update({ status: "done", done_at: new Date().toISOString(), done_note: note.trim() || null })
      .eq("id", plan.id);
    if (error) { alert(error.message); return; }
    setAsking(false); onChanged();
  };

  const print = () => printReport({
    title: KIND_LABEL[plan.kind],
    subtitle: `${q.title} · ${q.subject_name ?? ""}`,
    sections: [
      { title: "بيانات الخطة", headers: ["البند", "التفصيل"], rows: [
        ["الاختبار", `${q.title} (${q.period === "diagnostic" ? "تشخيصي" : q.period === "period1" ? "الفترة الأولى" : "الفترة الثانية"})`],
        ["المهارات المستهدفة", plan.skills ?? ""],
        ["الإجراءات والاستراتيجيات", plan.procedures ?? ""],
        ["مدة التنفيذ", [plan.start_date && fmtDate(plan.start_date), plan.end_date && fmtDate(plan.end_date)].filter(Boolean).join(" إلى ") || "—"],
        ["الحالة", done ? `نُفّذت · ${fmtDate(plan.done_at)}${plan.done_note ? ` · ${plan.done_note}` : ""}` : "قيد التنفيذ"],
      ] },
      { title: "الطلاب المستهدفون", headers: ["م", "الطالب", "الفصل", "النسبة"],
        rows: (plan.students ?? []).map((s, i) => [i + 1, s.name, s.cls ?? "", `${s.avg}٪`]) },
    ],
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
    signatures: [{ title: "المعلم", name: teacherName ?? "" }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }],
  });

  return (
    <div className="rounded-sm2 border border-line/60 bg-paper p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 font-semibold text-ink">
          {plan.round > 1 ? "الخطة العلاجية الثانية · دعم أعلى" : KIND_LABEL[plan.kind]}
        </p>
        <span className={`chip w-28 justify-center ${done ? "bg-mint-light text-mint-deep" : "bg-warning-light text-warning"}`}>
          {done ? "نُفّذت" : "قيد التنفيذ"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {countAr(plan.students?.length ?? 0, "student")} · {plan.skills}
      </p>
      {done && plan.done_note && <p className="mt-1 text-sm text-muted">ملاحظة التنفيذ: {plan.done_note}</p>}
      <div className="mt-2 flex flex-wrap gap-3 text-sm">
        <button className="text-mint-deep underline" onClick={print}>طباعة الخطة</button>
        {!done && <button className="text-ink underline" onClick={onEdit}>تعديل</button>}
        {!done && !asking && <button className="text-mint-deep underline" onClick={() => setAsking(true)}>تم التنفيذ</button>}
      </div>
      {asking && (
        <div className="mt-2 space-y-2">
          <textarea className="field min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="ملاحظة عن التنفيذ ونتيجته (اختياري)" />
          <div className="flex gap-2">
            <button className="btn-primary" onClick={markDone}>تأكيد التنفيذ</button>
            <button className="btn-ghost" onClick={() => setAsking(false)}>إلغاء</button>
          </div>
          <EvidenceTags items={[plan.kind === "remedial" ? "e06_04" : "e06_05"]} />
        </div>
      )}
    </div>
  );
}

const VERIFY_MODES = [["paper", "ورقي"], ["omr", "ورقي بتصحيح آلي"], ["online", "إلكتروني"], ["external", "من خارج البوابة"]];
const VERIFY_MODE_HINT = {
  paper: "ورقة قصيرة تُطبع لطلاب الخطة، ويُرصد مجموعها يدويًا.",
  omr: "ورقة ببطاقة تظليل تُصحَّح بالكاميرا.",
  online: "يُنشر لطلاب الخطة وحدهم ويُصحَّح آليًا فور التسليم، ويمكنك إضافة غيرهم عند النشر.",
  external: "بلا أسئلة في البوابة: ترصد مجموع كل طالب من اختبار طبّقته بنفسك.",
};

/* التحقق من أثر خطة علاجية نُفّذت: اختبار تحقق لطلابها، والقياس آلي بعد رصده */
function VerifyBox({ q, p, subs, vq, last, onPlan2, onChanged }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(q.mode ?? "omr");   // نوع اختبار التحقق، والافتراضي نوع الأصلي
  const auto = useRef(false);
  const ids = useMemo(() => new Set((p.students ?? []).map((s) => s.id)), [p.students]);
  const rows = (vq?.subs ?? []).filter((r) => ids.has(r.student_id));
  const graded = rows.filter((r) => !r.absent && r.score != null).length;
  const settled = rows.filter((r) => r.absent || r.score != null).length;
  const im = p.impact;

  const measure = useCallback(async (skip = null) => {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("quiz_plan_measure", { p_plan: p.id, p_skip: skip });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onChanged();
  }, [p.id, onChanged]);

  // القياس آلي حين يُرصد كل طلاب الخطة (أو يُسجَّل غيابهم)
  useEffect(() => {
    if (auto.current || p.measured_at || !p.verify_quiz_id || !graded || settled < ids.size) return;
    auto.current = true;
    measure();
  }, [p.measured_at, p.verify_quiz_id, graded, settled, ids.size, measure]);

  const create = async () => {
    setBusy(true); setErr("");
    const classIds = [...new Set(subs.filter((r) => ids.has(r.student_id)).map((r) => r.class_id).filter(Boolean))];
    const { data, error } = await supabase.from("quizzes").insert({
      teacher_id: q.teacher_id, mode, title: `اختبار تحقق: ${q.title}${p.round > 1 ? " (الجولة الثانية)" : ""}`,
      subject_id: q.subject_id, subject_name: q.subject_name, grade: q.grade, period: "verify",
      total_marks: q.total_marks, exam_date: todayISO(), duration_min: q.duration_min, lang: q.lang,
      instructions: p.skills ? `المهارات المستهدفة: ${p.skills}` : null,
      academic_year: q.academic_year, term: q.term, verify_plan_id: p.id,
      ...(mode === "external" ? { status: "ready" } : {}),
    }).select("id").single();
    if (!error && classIds.length) {
      await supabase.from("quiz_classes").insert(classIds.map((class_id) => ({ quiz_id: data.id, class_id, exam_date: todayISO() })));
    }
    const { error: e2 } = error ? { error } : await supabase.from("quiz_plans").update({ verify_quiz_id: data.id }).eq("id", p.id);
    setBusy(false);
    if (e2) { setErr(/verify|period/.test(e2.message) ? "اختبار التحقق يحتاج تنفيذ supabase/quiz_verify_1.sql مرة واحدة." : e2.message); return; }
    navigate(`/quizzes?q=${data.id}`);
  };

  const skip = () => {
    const why = window.prompt("سبب تعذّر التحقق (مثل: انتهاء الفصل الدراسي):");
    if (why?.trim()) measure(why.trim());
  };

  return (
    <div className="space-y-2 rounded-sm2 border border-mint-deep/30 bg-mint-tint/40 p-3 text-sm">
      <p className="font-semibold text-mint-deep">التحقق من أثر {p.round > 1 ? "الخطة الثانية" : "الخطة العلاجية"}</p>
      {im?.skipped ? (
        <p className="text-muted">تعذّر التحقق: {im.skipped}</p>
      ) : im ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[[<span className="num">{im.before}%</span>, "المتوسط قبل الخطة"], [<span className="num">{im.after}%</span>, "في اختبار التحقق"],
              [<><span className="num">{im.passed}</span> من <span className="num">{im.n}</span></>, "بلغوا 60% فأكثر"],
              [<><span className="num">{im.improved}</span> من <span className="num">{im.n}</span></>, "تحسّنت نسبتهم"]].map(([v, t]) => (
              <div key={t} className="rounded-sm2 bg-paper px-2 py-2 text-center">
                <p className="font-bold text-ink">{v}</p><p className="text-[11px] text-muted">{t}</p>
              </div>
            ))}
          </div>
          {im.missing > 0 && <p className="text-xs text-muted">لم يُختبر <span className="num">{im.missing}</span> من طلاب الخطة، فلم يدخلوا القياس.</p>}
          <button className="text-xs text-mint-deep underline" onClick={() => setOpen((v) => !v)}>{open ? "إخفاء الطلاب" : "نتيجة كل طالب"}</button>
          {open && (
            <div className="divide-y divide-line/60 rounded-sm2 bg-paper">
              {(im.students ?? []).map((x) => (
                <p key={x.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                  <span className="min-w-0 flex-1 truncate text-ink">{x.name}</span>
                  <span className="num text-muted">{x.before}%</span><span aria-hidden="true" className="text-faint">←</span>
                  <span className={`num font-bold ${x.after >= 60 ? "text-mint-deep" : "text-absent"}`}>{x.after}%</span>
                </p>
              ))}
            </div>
          )}
          {im.below > 0 && (p.round > 1
            ? <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-xs text-absent">بقي <span className="num">{im.below}</span> دون 60% بعد الخطة الثانية، ووصل المدير إشعار بهم.</p>
            : last && <button className="btn-primary" onClick={onPlan2}>إعداد الخطة العلاجية الثانية · دعم أعلى ({countAr(im.below + (im.missing ?? 0), "student")})</button>)}
        </>
      ) : p.verify_quiz_id ? (
        <>
          <p className="text-muted">
            «{vq?.title ?? "اختبار التحقق"}»: رُصد <span className="num">{graded}</span> من <span className="num">{ids.size}</span> من طلاب الخطة.
            يُقاس الأثر آليًا حين يكتمل الرصد.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => navigate(`/quizzes?q=${p.verify_quiz_id}`)}>فتح اختبار التحقق</button>
            {graded > 0 && settled < ids.size && <button className="btn-primary" disabled={busy} onClick={() => measure()}>قياس الأثر بمن رُصد</button>}
          </div>
        </>
      ) : (
        <>
          <p className="text-muted">
            أنشئ اختبارًا قصيرًا في المهارات المستهدفة لطلاب الخطة ({countAr(ids.size, "student")})، ويُقاس الأثر آليًا بعد رصده:
            نسبة كل طالب قبل الخطة مقابل نسبته في اختبار التحقق.
          </p>
          <div>
            <p className="text-xs text-muted">نوع اختبار التحقق</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {VERIFY_MODES.map(([k, t]) => (
                <button key={k} type="button" onClick={() => setMode(k)}
                        className={`rounded-pill px-3 py-1 text-xs font-medium ${mode === k ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`}>
                  {t}{k === q.mode ? " (نوع الأصلي)" : ""}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-faint">{VERIFY_MODE_HINT[mode]}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" disabled={busy} onClick={create}>إنشاء اختبار التحقق</button>
            <button className="text-xs text-muted underline" disabled={busy} onClick={skip}>تعذّر التحقق</button>
          </div>
        </>
      )}
      {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-xs text-danger">{err}</p>}
    </div>
  );
}

export default function QuizCycle({ q, questionsCount, teacherName, onChange }) {
  const [subs, setSubs] = useState(null);
  const [plans, setPlans] = useState([]);
  const [editing, setEditing] = useState(null);   // remedial | enrichment | remedial2
  const [verify, setVerify] = useState({});       // اختبارات التحقق: { [quiz_id]: { title, status, subs } }
  const [busy, setBusy] = useState(false);
  const [certified, setCertified] = useState(new Set());   // المتفوقون الذين صدرت لهم شهادة
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from("quiz_submissions").select("student_id, class_id, score, absent, students(full_name)").eq("quiz_id", q.id),
      supabase.from("quiz_plans").select("*").eq("quiz_id", q.id),
    ]);
    const rows = s ?? [];
    const ids = [...new Set(rows.map((r) => r.class_id).filter(Boolean))];
    const { data: cls } = ids.length ? await supabase.from("classes").select("id, class_no, grade").in("id", ids) : { data: [] };
    const cm = Object.fromEntries((cls ?? []).map((c) => [c.id, `${GRADE_NAMES[c.grade] ?? ""} ${c.class_no}`.trim()]));
    setSubs(rows.map((r) => ({ ...r, cls: cm[r.class_id] ?? "" })));
    setPlans(p ?? []);
    // اختبارات التحقق للخطط العلاجية ورصد طلابها
    const vIds = (p ?? []).map((x) => x.verify_quiz_id).filter(Boolean);
    if (vIds.length) {
      const [{ data: vz }, { data: vs }] = await Promise.all([
        supabase.from("quizzes").select("id, title, status").in("id", vIds),
        supabase.from("quiz_submissions").select("quiz_id, student_id, score, absent").in("quiz_id", vIds),
      ]);
      setVerify(Object.fromEntries((vz ?? []).map((z) => [z.id, { ...z, subs: (vs ?? []).filter((r) => r.quiz_id === z.id) }])));
    }
    // شهادات أصدرها المعلم لطلاب هذا الاختبار بعد التحليل
    const studentIds = rows.map((r) => r.student_id);
    if (studentIds.length && q.analyzed_at) {
      const { data: certs } = await supabase.from("form_documents")
        .select("student_id, form_templates!inner(category)")
        .eq("created_by", q.teacher_id).eq("form_templates.category", "certificate")
        .in("student_id", studentIds).gte("created_at", q.analyzed_at)
        .not("status", "in", "(draft,pending,rejected)");
      setCertified(new Set((certs ?? []).map((c) => c.student_id)));
    }
  }, [q.id, q.analyzed_at, q.teacher_id]);

  useEffect(() => { load(); }, [load]);

  // نتيجة كل طالب بالنسبة المئوية، ومن يحتاج دعمًا والمتفوقون
  const graded = useMemo(() => (subs ?? []).filter((r) => !r.absent && r.score != null).map((r) => ({
    id: r.student_id, name: r.students?.full_name ?? "—", cls: r.cls,
    avg: r1((Number(r.score) / Number(q.total_marks || 1)) * 100),
  })), [subs, q.total_marks]);
  const live = useMemo(() => ({
    graded: graded.length,
    avg: graded.length ? r1(graded.reduce((a, s) => a + s.avg, 0) / graded.length) : null,
    support: graded.filter((s) => s.avg < SUPPORT_PCT).sort((a, b) => a.avg - b.avg),
    top: graded.filter((s) => s.avg >= EXCEL_PCT).sort((a, b) => b.avg - a.avg),
  }), [graded]);
  const snap = q.analysis ?? live;

  if (subs === null) return null;

  // لكل نوع جولات: الخطة العلاجية الأولى، والثانية بدعم أعلى إن بقي طلاب دون 60% بعد التحقق
  const rounds = (k) => plans.filter((p) => p.kind === k).sort((a, b) => (a.round ?? 1) - (b.round ?? 1));
  const plan = (k) => rounds(k).at(-1);
  const lastRem = plan("remedial");
  const needRound2 = !!lastRem && (lastRem.round ?? 1) === 1 && !!lastRem.measured_at && Number(lastRem.impact?.below) > 0;
  const verifyOk = !lastRem || (lastRem.status === "done" && !!lastRem.measured_at && !needRound2);
  const round2Students = needRound2 ? [
    ...(lastRem.impact.students ?? []).filter((x) => x.after < 60).map((x) => ({ id: x.id, name: x.name, cls: x.cls, avg: x.after })),
    ...(lastRem.students ?? []).filter((x) => !(lastRem.impact.students ?? []).some((y) => y.id === x.id)),
  ] : [];
  const needPlan = q.period === "diagnostic" || (snap.support?.length ?? 0) > 0;
  const topList = snap.top ?? [];
  const honored = topList.length === 0 || !!q.honored_at || topList.every((s) => certified.has(s.id));
  const done = {
    data: true,
    questions: questionsCount > 0 || q.mode === "external",   // من خارج البوابة: أسئلته خارجها
    apply: q.status !== "draft",
    mark: graded.length > 0,
    analysis: !!q.analyzed_at,
    plan: !!q.analyzed_at && (!needPlan || !!plan("remedial")),
    execute: !!q.analyzed_at && plans.every((p) => p.status === "done") && (!needPlan || !!plan("remedial")) && honored,
    verify: !!q.analyzed_at && plans.every((p) => p.status === "done") && (!needPlan || !!plan("remedial")) && honored && verifyOk
      || !!q.cycle_closed_at,   // دورات أُغلقت قبل مرحلة التحقق
    close: !!q.cycle_closed_at,
  };
  const current = STAGES.findIndex((s) => !done[s.key]);

  const approveAnalysis = async () => {
    setBusy(true);
    const analysis = { graded: live.graded, avg: live.avg, support: live.support, top: live.top, at: new Date().toISOString() };
    const at = new Date().toISOString();
    const { error } = await supabase.from("quizzes").update({ analyzed_at: at, analysis }).eq("id", q.id);
    setBusy(false);
    if (error) { alert(error.message); return; }
    onChange({ analyzed_at: at, analysis });
  };

  const honorOther = async () => {
    if (!window.confirm("تأكيد تكريم المتفوقين بطريقة أخرى غير شهادات البوابة؟")) return;
    const at = new Date().toISOString();
    const { error } = await supabase.from("quizzes").update({ honored_at: at }).eq("id", q.id);
    if (error) { alert(error.message); return; }
    onChange({ honored_at: at });
  };

  const closeCycle = async () => {
    setBusy(true);
    const at = new Date().toISOString();
    const { error } = await supabase.from("quizzes").update({ cycle_closed_at: at }).eq("id", q.id);
    setBusy(false);
    if (error) { alert(error.message); return; }
    onChange({ cycle_closed_at: at });
  };

  const stageNote = {
    questions: "أضف أسئلة الاختبار من تبويب «الأسئلة».",
    apply: "اجعل الاختبار جاهزًا للطباعة أو أطلقه إلكترونيًا.",
    mark: "صحّح الاختبار وارصد الدرجات من «التصحيح والدرجات».",
  };

  return (
    <section className="no-print card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-ink">دورة الاختبار</h2>
        <span className="text-xs text-muted">كل مرحلة منجزة تصل شاهدًا إلى «شواهد الأداء الوظيفي»</span>
      </div>

      {/* شريط المراحل — بأسلوب شريط مراحل الأحداث والمناسبات */}
      <ol className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {STAGES.map((s, i) => {
          const ok = done[s.key];
          const now = i === current;
          return (
            <li key={s.key}
              className={`flex shrink-0 items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium ${
                now ? "bg-mint-deep text-white"
                : ok ? "border border-[#CCF2DB] bg-mint-tint text-mint-deep"
                : "border border-line bg-white text-faint"}`}>
              <span className={`num grid h-4 w-4 place-items-center rounded-full text-[10px] ${
                now ? "bg-white/25" : ok ? "bg-white" : "bg-canvas"}`}>
                {ok ? "✓" : i + 1}
              </span>
              {s.label}
            </li>
          );
        })}
      </ol>

      {current >= 0 && stageNote[STAGES[current].key] && (
        <div className="flex flex-wrap items-center gap-2 rounded-sm2 bg-canvas px-3 py-2 text-sm text-muted">
          <p className="flex-1">{stageNote[STAGES[current].key]}</p>
          {STAGES[current].key === "mark" && (
            <Link className="btn-primary shrink-0 px-4 py-1.5 text-xs" to={`/quiz-marks?q=${q.id}`}>
              الذهاب إلى التصحيح والدرجات
            </Link>
          )}
        </div>
      )}

      {done.mark && !done.analysis && (
        <div className="space-y-2 rounded-sm2 bg-canvas p-3 text-sm">
          <p className="text-ink">
            صُحّح <span className="num">{live.graded}</span> طالبًا · المتوسط <span className="num">{live.avg}%</span> ·
            يحتاج دعمًا <span className="num">{live.support.length}</span> · المتفوقون <span className="num">{live.top.length}</span>
          </p>
          <p className="text-muted">راجع التحليل التفصيلي والفقرات، ثم اعتمده لتنتقل إلى الخطة.</p>
          <div className="flex flex-wrap gap-2">
            <Link className="btn-ghost" to="/quiz-analytics">فتح تحليل النتائج</Link>
            <button className="btn-primary" onClick={approveAnalysis} disabled={busy}>اعتماد التحليل</button>
          </div>
          <EvidenceTags items={["e10_01", "e10_02"]} />
        </div>
      )}

      {done.analysis && (
        <div className="space-y-3">
          {!needPlan && (
            <p className="rounded-sm2 bg-mint-tint px-3 py-2 text-sm text-mint-deep">
              لا يوجد من يحتاج دعمًا، فلا تلزم خطة علاجية. الخطة الإثرائية اختيارية.
            </p>
          )}
          {rounds("remedial").map((p) => (
            <div key={p.id} className="space-y-2">
              {editing === "remedial" && p === lastRem
                ? <PlanForm q={q} kind="remedial" plan={p} round={p.round ?? 1} suggested={snap.support ?? []}
                            onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
                : <PlanCard q={q} plan={p} teacherName={teacherName} onEdit={() => setEditing("remedial")} onChanged={load} />}
              {p.status === "done" && !(q.cycle_closed_at && !p.measured_at) && (
                <VerifyBox q={q} p={p} subs={subs} vq={verify[p.verify_quiz_id]} last={p === lastRem}
                           onPlan2={() => setEditing("remedial2")} onChanged={load} />
              )}
            </div>
          ))}
          {editing === "remedial2" && needRound2 && (
            <PlanForm q={q} kind="remedial" round={2} parentId={lastRem.id} suggested={round2Students}
                      onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
          )}
          {["remedial", "enrichment"].map((k) => {
            if (k === "remedial" && plan(k)) return null;
            const p = plan(k);
            if (editing === k) {
              return <PlanForm key={k} q={q} kind={k} plan={p} suggested={k === "remedial" ? snap.support ?? [] : snap.top ?? []}
                               onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />;
            }
            if (p) return <PlanCard key={k} q={q} plan={p} teacherName={teacherName} onEdit={() => setEditing(k)} onChanged={load} />;
            if (done.close) return null;
            const required = k === "remedial" && needPlan;
            return (
              <button key={k} className={required ? "btn-primary" : "btn-ghost"} onClick={() => setEditing(k)}>
                {k === "remedial" ? "إعداد الخطة العلاجية" : "إعداد خطة إثرائية (اختياري)"}
                {k === "remedial" && required && <span className="mr-1">({countAr(snap.support?.length ?? 0, "student")})</span>}
              </button>
            );
          })}
        </div>
      )}

      {done.analysis && topList.length > 0 && (
        <div className="space-y-2 rounded-sm2 border border-line/60 bg-paper p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 font-semibold text-ink">تكريم المتفوقين</p>
            <span className={`chip w-28 justify-center ${honored ? "bg-mint-light text-mint-deep" : "bg-warning-light text-warning"}`}>
              {honored ? "تمّ التكريم" : "بانتظار التكريم"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {topList.map((s) => (
              <span key={s.id} className={`chip ${certified.has(s.id) ? "bg-mint-light text-mint-deep" : "bg-canvas text-muted"}`}>
                {certified.has(s.id) ? "✓ " : ""}{s.name} <span className="num mr-1">{s.avg}%</span>
              </span>
            ))}
          </div>
          {!honored && (
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn-primary" onClick={() => navigate("/forms", { state: { honor: {
                quiz: q.title, reason: `لتفوقه في ${q.title}`,
                students: topList.filter((s) => !certified.has(s.id)).map((s) => ({ id: s.id, full_name: s.name })) } } })}>
                إصدار شهادات التكريم
              </button>
              <button className="text-sm text-muted underline" onClick={honorOther}>كُرّموا بطريقة أخرى</button>
            </div>
          )}
          {!honored && <EvidenceTags items={["e05_10"]} />}
        </div>
      )}

      {done.verify && !done.close && (
        <div className="flex flex-wrap items-center gap-3 rounded-sm2 bg-mint-tint p-3 text-sm">
          <p className="flex-1 text-mint-deep">اكتملت المراحل. أغلق الدورة ليُحفظ تقرير الاختبار في ملف شواهدك.</p>
          <button className="btn-primary" onClick={closeCycle} disabled={busy}>إغلاق الدورة</button>
        </div>
      )}
      {done.close && (
        <p className="rounded-sm2 bg-mint-light px-3 py-2 text-sm text-mint-deep">
          أُغلقت الدورة في <span className="num">{fmtDate(q.cycle_closed_at)}</span>، ووصلت شواهدها إلى ملفك.
        </p>
      )}
    </section>
  );
}
