// src/pages/lab/exams/ExamCreate.jsx
// إنشاء اختبار في مركز اختبارات التقنية الرقمية:
// • نظري: الصف والوحدات وعدد الأسئلة من كل نوع، فيُولَّد من البنك موزعًا على الدروس، ويُستبدل أي سؤال أو يُعاد التوليد.
// • عملي: الصيغة (آلي، سلّم تقدير، مختلط) وتوزيع الدرجة، ومهام الأجهزة من تدريبات الدروس، وبطاقات الأداء.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { notify } from "../../../lib/notice";
import { LESSONS } from "../../../lab-content/index.js";
import { EXAM_GRADES, KIND_T, THEORY_TOTAL, PRACTICAL_TOTAL, buildTheory, gradeOfLesson, mergeBank, newExamSecrets, shuffle, withMarks } from "../../../lib/labExam.js";
import { PRACTICAL_MODES, RUBRIC_CARDS, autoTasks, scaleCriteria } from "../../../lib/labPractical.js";
import { gradeClasses, setupMsg } from "../../../lib/labExamData.js";
import { ExamQuestion } from "./ExamBank.jsx";

const L = ({ children }) => <p className="mb-1.5 text-[12.5px] font-semibold text-ink">{children}</p>;
const pill = (on) => `rounded-pill px-3 py-1.5 text-xs font-medium transition-colors ${on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`;
const unitsOf = (grade) => [...new Map(LESSONS.filter((l) => gradeOfLesson(l) === grade).map((l) => [l.unit.no, l.unit])).values()];

export default function ExamCreate({ kind, lab, onCancel, onSaved }) {
  const [grade, setGrade] = useState(1);
  const [title, setTitle] = useState("");
  const [units, setUnits] = useState([]);
  const [classes, setClasses] = useState([]);
  const [picked, setPicked] = useState([]);
  const [duration, setDuration] = useState(kind === "theory" ? 45 : 60);
  const [busy, setBusy] = useState(false);
  const [bank, setBank] = useState(null);
  useEffect(() => { supabase.from("lab_qbank").select("*").then(({ data }) => setBank(mergeBank(data ?? []))); }, []);
  useEffect(() => {
    setUnits(unitsOf(grade).map((u) => u.no));
    setTitle(`${kind === "theory" ? "الاختبار النهائي النظري" : "الاختبار العملي"} · ${EXAM_GRADES[grade].subject}`);
    gradeClasses(grade, lab).then((c) => { setClasses(c); setPicked(c.map((x) => x.class_id)); });
  }, [grade, kind, lab]);

  const toggle = (arr, v, set) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const save = async (body, total) => {
    if (!title.trim()) { notify({ ok: false, text: "اكتب عنوان الاختبار." }); return; }
    if (!picked.length) { notify({ ok: false, text: "اختر فصلًا واحدًا على الأقل." }); return; }
    setBusy(true);
    const row = { lab_id: lab, kind, grade, title: title.trim(), total, duration: Number(duration) || null, classes: picked, body, ...newExamSecrets() };
    const { data, error } = await supabase.from("lab_exams").insert(row).select().single();
    setBusy(false);
    if (error) { notify({ ok: false, text: setupMsg(error) }); return; }
    notify({ ok: true, text: "حُفظ الاختبار." });
    onSaved(data);
  };

  const common = (
    <section className="card space-y-4 p-4">
      <div><L>الصف</L>
        <div className="flex flex-wrap gap-1.5">{Object.entries(EXAM_GRADES).map(([g, x]) => (
          <button key={g} type="button" className={pill(grade === Number(g))} onClick={() => setGrade(Number(g))}>{x.t} · {x.subject}</button>))}</div></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <div><L>العنوان</L><input className="field" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><L>المدة (دقيقة)</L><input className="field num" type="number" min={5} max={240} value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
      </div>
      <div><L>الوحدات</L>
        <div className="flex flex-wrap gap-1.5">{unitsOf(grade).map((u) => (
          <button key={u.no} type="button" className={pill(units.includes(u.no))} onClick={() => toggle(units, u.no, setUnits)}>الوحدة {u.no}: {u.title}</button>))}</div></div>
      <div><L>الفصول</L>
        {!classes.length ? <p className="text-xs text-muted">لا فصول لهذا الصف في المعمل.</p> : (
          <div className="flex flex-wrap gap-1.5">{classes.map((c) => (
            <button key={c.class_id} type="button" className={pill(picked.includes(c.class_id))} onClick={() => toggle(picked, c.class_id, setPicked)}>
              فصل <span className="num">{c.class_no}</span></button>))}</div>)}</div>
    </section>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>رجوع</button>
        <h2 className="text-base font-bold text-ink">{kind === "theory" ? "اختبار نهائي نظري جديد" : "اختبار عملي جديد"}</h2>
      </div>
      {common}
      {!bank ? null : kind === "theory"
        ? <TheoryPart bank={bank} grade={grade} units={units} busy={busy} onSave={(qs) => save({ questions: qs }, THEORY_TOTAL)} />
        : <PracticalPart grade={grade} units={units} busy={busy} onSave={(body) => save(body, PRACTICAL_TOTAL)} />}
    </div>
  );
}

/* ---------------- النظري ---------------- */
function TheoryPart({ bank, grade, units, busy, onSave }) {
  const pool = bank.filter((q) => !q.hidden && q.grade === grade && units.includes(q.unit));
  const avail = { mcq: pool.filter((q) => q.kind === "mcq").length, truefalse: pool.filter((q) => q.kind === "truefalse").length, match: pool.filter((q) => q.kind === "match").length };
  const [counts, setCounts] = useState({ mcq: 20, truefalse: 10, match: 0 });
  const [seed, setSeed] = useState(() => String(Date.now()));
  const [qs, setQs] = useState(null);
  const gen = (s = seed) => setQs(buildTheory(bank, { grade, units, counts, seed: s }));
  useEffect(() => { setQs(null); }, [grade, units]);
  const replace = (i) => {
    const q = qs[i], used = new Set(qs.map((x) => x.id));
    const alt = shuffle(pool.filter((x) => x.kind === q.kind && !used.has(x.id)), `${seed}:${q.id}:${Date.now()}`)[0];
    if (!alt) { notify({ ok: false, text: "لا سؤال بديل من النوع نفسه في الوحدات المختارة." }); return; }
    setQs(withMarks(qs.map((x, j) => (j === i ? alt : x)), THEORY_TOTAL));
  };
  const items = (qs ?? []).length;

  return (
    <>
      <section className="card space-y-3 p-4">
        <L>عدد الأسئلة من كل نوع</L>
        <div className="grid gap-3 sm:grid-cols-3">{Object.keys(KIND_T).map((k) => (
          <label key={k} className="block text-sm"><span className="text-muted">{KIND_T[k]} <span className="num text-[11px]">(المتاح {avail[k]})</span></span>
            <input type="number" min={0} max={avail[k]} className="field num mt-1" value={counts[k]}
                   onChange={(e) => setCounts({ ...counts, [k]: Math.max(0, Math.min(avail[k], Number(e.target.value) || 0)) })} /></label>))}</div>
        <p className="text-[12px] text-muted">توزَّع الدرجة <span className="num">15</span> بالتساوي على البنود (المزاوجة بعدد عناصرها)، وتُختار الأسئلة موزعة على دروس الوحدات.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={!units.length} onClick={() => gen()}>{qs ? "تحديث" : "توليد الاختبار"}</button>
          {qs && <button type="button" className="btn-ghost" onClick={() => { const s = String(Date.now()); setSeed(s); gen(s); }}>توليد أسئلة أخرى</button>}
        </div>
      </section>
      {qs && (
        <section className="space-y-2">
          <p className="text-sm text-muted"><b className="num text-ink">{items}</b> سؤالًا · مجموع الدرجات <b className="num text-ink">{qs.reduce((a, q) => a + q.marks, 0)}</b></p>
          {qs.map((q, i) => <ExamQuestion key={q.id} q={q} n={i + 1} action={<button type="button" className="text-xs font-semibold text-mint-deep" onClick={() => replace(i)}>استبدال</button>} />)}
          <button type="button" className="btn-primary" disabled={busy || !items} onClick={() => onSave(qs)}>{busy ? "جارٍ الحفظ…" : "حفظ الاختبار"}</button>
        </section>
      )}
    </>
  );
}

/* ---------------- العملي ---------------- */
function PracticalPart({ grade, units, busy, onSave }) {
  const [mode, setMode] = useState("mixed");
  const [autoMarks, setAutoMarks] = useState(10);
  const all = useMemo(() => autoTasks().filter((t) => t.grade === grade && units.includes(t.unit)), [grade, units]);
  const [taskIds, setTaskIds] = useState([]);
  const cards = RUBRIC_CARDS.filter((c) => c.grade === grade && units.includes(c.unit));
  const [cardIds, setCardIds] = useState([]);
  const [custom, setCustom] = useState([]);
  useEffect(() => {
    setTaskIds(shuffle(all, `${grade}:${units.join()}`).slice(0, 5).map((t) => t.id));
    setCardIds(cards.slice(0, 3).map((c) => c.id));
  }, [grade, units.join()]);   // eslint-disable-line react-hooks/exhaustive-deps

  const aM = mode === "auto" ? PRACTICAL_TOTAL : mode === "rubric" ? 0 : Number(autoMarks) || 0;
  const rM = PRACTICAL_TOTAL - aM;
  const toggle = (arr, v, set) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const submit = () => {
    const tasks = aM ? all.filter((t) => taskIds.includes(t.id)) : [];
    const chosen = rM ? [...cards.filter((c) => cardIds.includes(c.id)), ...custom.filter((c) => c.title.trim() && c.criteria.some((x) => x.t.trim()))] : [];
    if (aM && !tasks.length) { notify({ ok: false, text: "اختر مهمة آلية واحدة على الأقل." }); return; }
    if (rM && !chosen.length) { notify({ ok: false, text: "اختر بطاقة أداء واحدة على الأقل." }); return; }
    // درجة كل مهمة آلية بالتساوي بأرباع الدرجة
    const per = withMarks(tasks.map((t) => ({ ...t, kind: "mcq" })), aM).map((t) => t.marks);
    onSave({ mode, autoMarks: aM, rubricMarks: rM,
      tasks: tasks.map((t, i) => ({ id: t.id, lesson: t.lesson, lessonTitle: t.lessonTitle, title: t.title, widget: t.widget, task: t.task, marks: per[i] })),
      cards: chosen.map((c) => ({ id: c.id, title: c.title, app: c.app, task: c.task, criteria: scaleCriteria({ criteria: c.criteria.filter((x) => x.t.trim()) }, rM) })) });
  };

  return (
    <>
      <section className="card space-y-3 p-4">
        <L>صيغة الاختبار العملي</L>
        <div className="grid gap-2 sm:grid-cols-3">{Object.entries(PRACTICAL_MODES).map(([k, m]) => (
          <button key={k} type="button" onClick={() => setMode(k)}
                  className={`rounded-card border p-3 text-right ${mode === k ? "border-mint-deep bg-mint-tint" : "border-line bg-paper"}`}>
            <b className="block text-sm text-ink">{m.t}</b><span className="text-[11.5px] text-muted">{m.d}</span></button>))}</div>
        {mode === "mixed" && (
          <label className="block text-sm"><span className="text-muted">درجة الجزء الآلي من <span className="num">25</span> (والباقي للأداء)</span>
            <input type="number" min={1} max={24} className="field num mt-1 max-w-[8rem]" value={autoMarks} onChange={(e) => setAutoMarks(e.target.value)} /></label>)}
        <p className="text-[12px] text-muted">الجزء الآلي <b className="num text-ink">{aM}</b> · جزء الأداء <b className="num text-ink">{rM}</b></p>
      </section>

      {aM > 0 && (
        <section className="card space-y-2 p-4">
          <L>مهام الأجهزة <span className="font-normal text-muted">(من تدريبات الدروس · المختار <span className="num">{taskIds.length}</span>)</span></L>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">{all.map((t) => (
            <label key={t.id} className={`flex cursor-pointer items-start gap-2 rounded-sm2 border px-3 py-2 text-sm ${taskIds.includes(t.id) ? "border-mint-deep bg-mint-tint" : "border-line"}`}>
              <input type="checkbox" className="mt-1 accent-mint-deep" checked={taskIds.includes(t.id)} onChange={() => toggle(taskIds, t.id, setTaskIds)} />
              <span><b className="text-ink">{t.title}</b><span className="block text-[11.5px] text-muted">{t.lessonTitle} · {typeof t.task.prompt === "string" ? t.task.prompt : t.widget}</span></span>
            </label>))}</div>
        </section>
      )}

      {rM > 0 && (
        <section className="card space-y-2 p-4">
          <L>بطاقات الأداء <span className="font-normal text-muted">(تُوزَّع على الطلاب بالقرعة · المختار <span className="num">{cardIds.length + custom.length}</span>)</span></L>
          {cards.map((c) => (
            <label key={c.id} className={`flex cursor-pointer items-start gap-2 rounded-sm2 border px-3 py-2 text-sm ${cardIds.includes(c.id) ? "border-mint-deep bg-mint-tint" : "border-line"}`}>
              <input type="checkbox" className="mt-1 accent-mint-deep" checked={cardIds.includes(c.id)} onChange={() => toggle(cardIds, c.id, setCardIds)} />
              <span><b className="text-ink">{c.title}</b> <span className="text-[11px] text-muted">· {c.app}</span>
                <span className="block text-[12px] text-muted">{c.task}</span>
                <span className="block text-[11px] text-faint">{scaleCriteria(c, rM).map((x) => `${x.t} (${x.m})`).join(" · ")}</span></span>
            </label>))}
          {custom.map((c, i) => <CustomCard key={i} c={c} onChange={(v) => setCustom(custom.map((x, j) => (j === i ? v : x)))} onRemove={() => setCustom(custom.filter((_, j) => j !== i))} />)}
          <button type="button" className="text-xs font-semibold text-mint-deep" onClick={() => setCustom([...custom, { id: `custom-${Date.now()}`, title: "", app: "", task: "", criteria: [{ t: "", w: 1 }, { t: "", w: 1 }] }])}>+ بطاقة من إعدادك</button>
        </section>
      )}
      <button type="button" className="btn-primary" disabled={busy} onClick={submit}>{busy ? "جارٍ الحفظ…" : "حفظ الاختبار"}</button>
    </>
  );
}

function CustomCard({ c, onChange, onRemove }) {
  const set = (k, v) => onChange({ ...c, [k]: v });
  return (
    <div className="space-y-2 rounded-sm2 border border-dashed border-line p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="field text-sm" placeholder="عنوان المهمة" value={c.title} onChange={(e) => set("title", e.target.value)} />
        <input className="field text-sm" placeholder="البرنامج" value={c.app} onChange={(e) => set("app", e.target.value)} />
      </div>
      <textarea className="field min-h-[60px] text-sm" placeholder="نص المهمة كما يقرؤه الطالب" value={c.task} onChange={(e) => set("task", e.target.value)} />
      {c.criteria.map((x, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className="field py-1.5 text-sm" placeholder={`المعيار ${i + 1}`} value={x.t} onChange={(e) => set("criteria", c.criteria.map((y, j) => (j === i ? { ...y, t: e.target.value } : y)))} />
          <input type="number" min={1} max={10} title="الوزن" className="field num w-16 py-1.5 text-sm" value={x.w} onChange={(e) => set("criteria", c.criteria.map((y, j) => (j === i ? { ...y, w: Number(e.target.value) || 1 } : y)))} />
          <button type="button" className="text-xs text-danger" onClick={() => set("criteria", c.criteria.filter((_, j) => j !== i))}>✕</button>
        </div>))}
      <div className="flex gap-3 text-xs">
        <button type="button" className="font-semibold text-mint-deep" onClick={() => set("criteria", [...c.criteria, { t: "", w: 1 }])}>+ معيار</button>
        <button type="button" className="text-danger" onClick={onRemove}>حذف البطاقة</button>
      </div>
    </div>
  );
}
