// src/pages/lab/exams/ExamBank.jsx
// بنك أسئلة التقنية الرقمية: أسئلة الدروس (الاختبارات وتحقق الفهم) مصنفة بالصف والوحدة والدرس والنوع.
// يعدّل المعلم نص أي سؤال وخياراته وإجابته، أو يخفيه من الاختبارات، أو يضيف سؤالًا (lab_qbank).
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { notify } from "../../../lib/notice";
import Loader from "../../../components/Loader.jsx";
import { LESSONS } from "../../../lab-content/index.js";
import { EXAM_GRADES, KIND_T, gradeOfLesson, mergeBank } from "../../../lib/labExam.js";
import { setupMsg } from "../../../lib/labExamData.js";

const LTRS = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];
const pill = (on) => `rounded-pill px-3 py-1 text-xs font-medium transition-colors ${on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`;

/** عرض سؤال بإجابته الصحيحة مظللة */
export function ExamQuestion({ q, n, action }) {
  return (
    <div className={`card space-y-2 p-3 ${q.hidden ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-2">
        <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mint-deep text-[11px] font-bold text-white">{n}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-relaxed text-ink">{q.text}</p>
          <p className="text-[11px] text-faint">{KIND_T[q.kind]} · الوحدة {q.unit}{q.lessonTitle ? ` · ${q.lessonTitle}` : ""}{q.marks != null ? ` · ${q.marks} درجة` : ""}
            {q.custom && " · مضاف"}{q.edited && " · معدّل"}{q.hidden && " · مخفي"}</p>
        </div>
        {action}
      </div>
      {q.kind === "mcq" && <div className="grid gap-1 sm:grid-cols-2">{q.options.map((o, k) => (
        <span key={k} className={`rounded-sm2 px-2 py-1 text-[12.5px] ${String(k) === String(q.answer) ? "bg-present/10 font-semibold text-present" : "bg-canvas text-ink"}`}>{LTRS[k]}) {o}</span>))}</div>}
      {q.kind === "truefalse" && <p className="text-[12.5px] font-semibold text-present">{q.answer === "true" ? "صح" : "خطأ"}</p>}
      {q.kind === "match" && <div className="space-y-0.5 text-[12.5px]">{q.options.left.map((l, k) => (
        <p key={k}><span className="text-ink">{l}</span> ← <span className="font-semibold text-present">{q.options.right[Number(q.answer[String(k)])]}</span></p>))}</div>}
    </div>
  );
}

export default function ExamBank({ canEdit }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [grade, setGrade] = useState(1);
  const [unit, setUnit] = useState(0);
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const load = () => supabase.from("lab_qbank").select("*").then(({ data, error }) => { if (error) setErr(setupMsg(error)); setRows(data ?? []); });
  useEffect(() => { load(); }, []);
  const bank = useMemo(() => mergeBank(rows ?? []), [rows]);
  const units = [...new Map(LESSONS.filter((l) => gradeOfLesson(l) === grade).map((l) => [l.unit.no, l.unit])).values()];
  const shown = bank.filter((x) => x.grade === grade && (!unit || x.unit === unit) && (!kind || x.kind === kind) && (!q.trim() || x.text?.includes(q.trim())));

  const upsert = async (x, patch) => {
    const r = (rows ?? []).find((y) => y.qid === x.id);
    const row = { qid: x.id, grade: x.grade, unit: x.unit, lesson: x.lesson ?? null, custom: !!x.custom, hidden: r?.hidden ?? false, data: r?.data ?? {}, ...patch, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("lab_qbank").upsert(row);
    if (error) notify({ ok: false, text: setupMsg(error) }); else load();
  };
  const reset = async (x) => { await supabase.from("lab_qbank").delete().eq("qid", x.id); load(); };

  if (!rows) return <Loader />;
  if (edit) return <QuestionEditor q={edit} units={units} onCancel={() => setEdit(null)}
    onSave={async (data) => { await upsert(edit, { data, custom: !!edit.custom, unit: data.unit ?? edit.unit }); setEdit(null); }} />;

  return (
    <div className="space-y-3">
      {err && <p className="rounded-card bg-warning-light px-3 py-2 text-sm text-late">{err}</p>}
      <div className="card space-y-2 p-3">
        <div className="flex flex-wrap gap-1.5">{Object.entries(EXAM_GRADES).map(([g, x]) => (
          <button key={g} type="button" className={pill(grade === Number(g))} onClick={() => { setGrade(Number(g)); setUnit(0); }}>{x.t}</button>))}</div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={pill(!unit)} onClick={() => setUnit(0)}>كل الوحدات</button>
          {units.map((u) => <button key={u.no} type="button" className={pill(unit === u.no)} onClick={() => setUnit(u.no)}>الوحدة {u.no}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={pill(!kind)} onClick={() => setKind("")}>كل الأنواع</button>
          {Object.entries(KIND_T).map(([k, t]) => <button key={k} type="button" className={pill(kind === k)} onClick={() => setKind(k)}>{t}</button>)}
          <input className="field ms-auto w-full py-1.5 text-sm sm:w-56" placeholder="بحث في نص السؤال" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted"><b className="num text-ink">{shown.length}</b> سؤالًا · منها مخفي <b className="num text-ink">{shown.filter((x) => x.hidden).length}</b></p>
        {canEdit && <button type="button" className="btn-ghost ms-auto py-1.5 text-sm" onClick={() => setEdit({ id: `custom-${Date.now()}`, custom: true, grade, unit: unit || units[0]?.no, kind: "mcq", text: "", options: ["", "", "", ""], answer: "0" })}>+ سؤال جديد</button>}
      </div>
      {shown.map((x, i) => (
        <ExamQuestion key={x.id} q={x} n={i + 1} action={canEdit && (
          <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
            <button type="button" className="font-semibold text-mint-deep" onClick={() => setEdit(x)}>تعديل</button>
            <button type="button" className="text-muted" onClick={() => upsert(x, { hidden: !x.hidden })}>{x.hidden ? "إظهار" : "إخفاء"}</button>
            {(x.edited || x.hidden) && !x.custom && <button type="button" className="text-muted underline" onClick={() => reset(x)}>الأصل</button>}
          </div>)} />
      ))}
    </div>
  );
}

function QuestionEditor({ q, units, onCancel, onSave }) {
  const [x, setX] = useState(() => ({ kind: q.kind, text: q.text ?? "", unit: q.unit,
    options: q.kind === "match" ? { left: [...q.options.left], right: [...q.options.right] } : [...(q.options ?? ["", "", "", ""])], answer: q.answer }));
  const set = (k, v) => setX((o) => ({ ...o, [k]: v }));
  const setKind = (k) => setX((o) => ({ ...o, kind: k, options: k === "match" ? { left: ["", "", ""], right: ["", "", ""] } : k === "mcq" ? ["", "", "", ""] : undefined,
    answer: k === "match" ? { 0: "0", 1: "1", 2: "2" } : k === "mcq" ? "0" : "true" }));
  const save = () => {
    if (!x.text.trim()) { notify({ ok: false, text: "اكتب نص السؤال." }); return; }
    if (x.kind === "mcq" && x.options.filter((o) => o.trim()).length < 2) { notify({ ok: false, text: "خياران على الأقل." }); return; }
    let data = { ...x, text: x.text.trim() };
    if (x.kind === "mcq") data.options = x.options.map((o) => o.trim()).filter(Boolean);
    if (x.kind === "match") {
      // المزاوجة تُكتب أزواجًا بالترتيب، ويُخلط العمود الثاني عند الحفظ
      const pairs = x.options.left.map((l, k) => [l.trim(), x.options.right[k]?.trim()]).filter(([a, b]) => a && b);
      const order = pairs.map((_, i) => i).sort((a, b) => ((a * 7 + 3) % pairs.length) - ((b * 7 + 3) % pairs.length));
      data = { ...data, options: { left: pairs.map((p) => p[0]), right: order.map((i) => pairs[i][1]) }, answer: Object.fromEntries(pairs.map((_, i) => [String(i), String(order.indexOf(i))])) };
    }
    onSave(data);
  };
  // المزاوجة تُعرض للتعديل أزواجًا: العنصر ومقابله الصحيح
  const pairs = x.kind === "match" ? x.options.left.map((l, k) => [l, x.options.right[Number(x.answer?.[String(k)] ?? k)] ?? ""]) : [];
  const setPair = (k, side, v) => {
    const p = pairs.map((y, j) => (j === k ? (side === 0 ? [v, y[1]] : [y[0], v]) : y));
    setX((o) => ({ ...o, options: { left: p.map((y) => y[0]), right: p.map((y) => y[1]) }, answer: Object.fromEntries(p.map((_, i) => [String(i), String(i)])) }));
  };

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-2"><button type="button" className="btn-ghost" onClick={onCancel}>رجوع</button>
        <h3 className="font-bold text-ink">{q.custom ? "سؤال" : "تعديل سؤال من الدروس"}</h3></div>
      {q.custom && <div className="flex flex-wrap gap-1.5">{Object.entries(KIND_T).map(([k, t]) => <button key={k} type="button" className={pill(x.kind === k)} onClick={() => setKind(k)}>{t}</button>)}
        <select className="field ms-auto w-auto py-1 text-sm" value={x.unit} onChange={(e) => set("unit", Number(e.target.value))}>{units.map((u) => <option key={u.no} value={u.no}>الوحدة {u.no}</option>)}</select></div>}
      <textarea className="field min-h-[70px] text-sm" value={x.text} onChange={(e) => set("text", e.target.value)} placeholder="نص السؤال" />
      {x.kind === "mcq" && x.options.map((o, k) => (
        <label key={k} className="flex items-center gap-2 text-sm">
          <input type="radio" name="ans" className="accent-mint-deep" checked={String(x.answer) === String(k)} onChange={() => set("answer", String(k))} />
          <input className="field py-1.5 text-sm" value={o} placeholder={`الخيار ${LTRS[k]}`} onChange={(e) => set("options", x.options.map((y, j) => (j === k ? e.target.value : y)))} />
        </label>))}
      {x.kind === "mcq" && x.options.length < 6 && <button type="button" className="text-xs font-semibold text-mint-deep" onClick={() => set("options", [...x.options, ""])}>+ خيار</button>}
      {x.kind === "truefalse" && <div className="flex gap-1.5">{[["true", "صح"], ["false", "خطأ"]].map(([v, t]) => <button key={v} type="button" className={pill(x.answer === v)} onClick={() => set("answer", v)}>{t}</button>)}</div>}
      {x.kind === "match" && (
        <div className="space-y-1.5">{pairs.map((p, k) => (
          <div key={k} className="grid grid-cols-2 gap-2">
            <input className="field py-1.5 text-sm" value={p[0]} placeholder="العنصر" onChange={(e) => setPair(k, 0, e.target.value)} />
            <input className="field py-1.5 text-sm" value={p[1]} placeholder="مقابله الصحيح" onChange={(e) => setPair(k, 1, e.target.value)} />
          </div>))}
          {pairs.length < 6 && <button type="button" className="text-xs font-semibold text-mint-deep" onClick={() => setX((o) => ({ ...o, options: { left: [...o.options.left, ""], right: [...o.options.right, ""] }, answer: { ...o.answer, [String(o.options.left.length)]: String(o.options.left.length) } }))}>+ زوج</button>}
        </div>)}
      <button type="button" className="btn-primary" onClick={save}>حفظ</button>
    </div>
  );
}
