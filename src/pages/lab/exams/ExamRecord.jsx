// src/pages/lab/exams/ExamRecord.jsx
// رصد الاختبار لكل فصل، وكل حفظ يُنقل فورًا إلى سجل التطبيقات (src/lib/labExamData.js):
// • رموز الأجهزة: يمسح المعلم رمز QR على شاشة الطالب، فتُصحَّح إجاباته (النظري) أو تُجمع درجات مهامه (العملي).
// • بطاقات الإجابة الورقية: تصوير بطاقة الطالب أو بطاقات الفصل دفعة واحدة، بقارئ البوابة نفسه.
// • سلّم التقدير: معايير بطاقة الأداء التي وقعت للطالب، بدرجة كل معيار من جوال المعلم.
// • الإدخال اليدوي والغياب.
import { useEffect, useMemo, useState } from "react";
import { notify } from "../../../lib/notice";
import Loader from "../../../components/Loader.jsx";
import QuizScan from "../../../components/QuizScan.jsx";
import QuizBatchScan from "../../../components/QuizBatchScan.jsx";
import LabScanner from "../LabScanner.jsx";
import { paperQuiz, readResultCode, scoreTheory, unpackAnswers } from "../../../lib/labExam.js";
import { cardFor } from "../../../lib/labPractical.js";
import { classStudents, loadSubs, saveSub } from "../../../lib/labExamData.js";
import { friendlyError } from "../../../lib/friendlyError.js";

const noCard = async () => null;
const SRC = { device: "الجهاز", paper: "الورقة", manual: "يدوي", rubric: "سلّم التقدير" };

export default function ExamRecord({ exam, classes }) {
  const theory = exam.kind === "theory";
  const b = exam.body ?? {};
  const [cls, setCls] = useState(classes[0]?.class_id ?? null);
  const [students, setStudents] = useState(null);
  const [subs, setSubs] = useState(null);
  const [mode, setMode] = useState(null);         // "device" | "scan" | "batch" | { rubric: student } | { manual: student }
  useEffect(() => { if (!cls && classes[0]) setCls(classes[0].class_id); }, [classes, cls]);
  const reload = () => loadSubs(exam.id).then(setSubs);
  useEffect(() => { reload(); }, [exam.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (cls) { setStudents(null); classStudents(cls, exam.lab_id).then(setStudents); } }, [cls, exam.lab_id]);
  const ids = useMemo(() => (students ?? []).map((s) => s.id), [students]);
  const quiz = useMemo(() => paperQuiz(exam), [exam]);

  const store = async (classId, sid, sub) => {
    try {
      const row = await saveSub(exam, classId, sid, sub);
      setSubs((m) => ({ ...m, [sid]: row }));
      return row;
    } catch (e) { notify({ ok: false, text: friendlyError(e.message) }); return null; }
  };
  // العملي: الجزآن يُجمعان، وكل جزء يُحفظ بمصدره
  const storePractical = (classId, sid, part) => {
    const d = { ...(subs?.[sid]?.detail ?? {}), ...part };
    const score = Math.round(((d.auto ?? 0) + (d.rubric ?? 0)) * 2) / 2;
    return store(classId, sid, { score, detail: d, answers: subs?.[sid]?.answers ?? null });
  };

  if (!classes.length) return <p className="card p-4 text-sm text-muted">لا فصول في هذا الاختبار.</p>;
  if (!students || !subs) return <Loader />;
  const done = students.filter((s) => subs[s.id] && !subs[s.id].absent).length;
  const avg = done ? students.reduce((a, s) => a + (subs[s.id]?.score ?? 0), 0) / done : 0;

  // QuizScan/QuizBatchScan: { id, full_name }، والنتائج { score, absent }
  const scanSubs = Object.fromEntries(students.filter((s) => subs[s.id]).map((s) => [s.id, subs[s.id]]));
  const onPaper = async (st, answers) => store(cls, st.id, { answers, score: scoreTheory(b.questions, answers), detail: { src: "paper" } });
  const onAbsent = async (st) => store(cls, st.id, { absent: true, detail: { src: "manual" } });

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <span className="text-sm text-muted">الفصل</span>
        {classes.map((c) => <button key={c.class_id} type="button" onClick={() => setCls(c.class_id)}
          className={`num rounded-pill px-3 py-1 text-xs ${cls === c.class_id ? "bg-mint-deep text-white" : "border border-line text-muted"}`}>{c.class_no}</button>)}
        <span className="ms-auto text-[12px] text-muted">رُصد <b className="num text-ink">{done}</b> من <span className="num">{students.length}</span>{done ? <> · المتوسط <b className="num text-ink">{avg.toFixed(1)}</b> من <span className="num">{exam.total}</span></> : null}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {(theory || b.autoMarks > 0) && <button type="button" className="btn-primary" onClick={() => setMode("device")}>مسح رموز الأجهزة</button>}
        {theory && <button type="button" className="btn-ghost" onClick={() => setMode("scan")}>تصوير بطاقة طالب</button>}
        {theory && <button type="button" className="btn-ghost" onClick={() => setMode("batch")}>تصحيح بطاقات الفصل دفعة واحدة</button>}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="bg-canvas text-right text-xs text-muted">
            <th className="p-2.5">الطالب</th>
            {!theory && b.autoMarks > 0 && <th className="p-2.5">الآلي ({b.autoMarks})</th>}
            {!theory && b.rubricMarks > 0 && <th className="p-2.5">الأداء ({b.rubricMarks})</th>}
            <th className="p-2.5">الدرجة ({exam.total})</th><th className="p-2.5">المصدر</th><th className="p-2.5" /></tr></thead>
          <tbody className="divide-y divide-line/60">{students.map((s) => {
            const r = subs[s.id], d = r?.detail ?? {};
            const card = !theory && b.rubricMarks > 0 ? cardFor(exam, ids, s.id) : null;
            return (
              <tr key={s.id}>
                <td className="p-2.5 text-ink">{s.full_name}{card && <span className="block text-[11px] text-muted">{card.title}</span>}</td>
                {!theory && b.autoMarks > 0 && <td className="num p-2.5">{d.auto ?? "—"}</td>}
                {!theory && b.rubricMarks > 0 && <td className="num p-2.5">{d.rubric ?? "—"}</td>}
                <td className="num p-2.5 font-bold text-mint-deep">{r?.absent ? <span className="text-absent">غائب</span> : r?.score ?? "—"}</td>
                <td className="p-2.5 text-[11.5px] text-muted">{theory ? SRC[d.src] ?? "" : [d.auto != null && "الجهاز", d.rubric != null && "سلّم التقدير"].filter(Boolean).join(" + ")}{d.seat ? ` · PC-${String(d.seat).padStart(2, "0")}` : ""}</td>
                <td className="p-2.5 text-left">
                  <div className="flex justify-end gap-2 text-xs">
                    {card && <button type="button" className="font-semibold text-mint-deep" onClick={() => setMode({ rubric: s, card })}>التقدير</button>}
                    <button type="button" className="text-muted" onClick={() => setMode({ manual: s })}>يدوي</button>
                  </div>
                </td>
              </tr>);
          })}</tbody>
        </table>
      </div>

      {mode === "device" && <DeviceScan exam={exam} onResult={async (res) => {
        const roster = b.rosters?.[res.cls];
        const sid = roster?.ids?.[res.stu];
        if (!sid) return { error: "الطالب غير موجود في قوائم الملف — أعد تنزيل ملف الاختبار بعد تحديث الفصول." };
        if (theory) {
          const answers = unpackAnswers(b.questions, res.body);
          const row = await store(roster.class_id, sid, { answers, score: scoreTheory(b.questions, answers), detail: { src: "device", seat: res.seat } });
          return row ? { ok: true, sid, score: row.score } : { error: "تعذّر الحفظ." };
        }
        const flags = res.body.split("");
        const auto = Math.round(b.tasks.reduce((a, t, i) => a + (flags[i] === "1" ? t.marks : 0), 0) * 2) / 2;
        const row = await storePractical(roster.class_id, sid, { auto, seat: res.seat, flags: res.body });
        return row ? { ok: true, sid, score: auto, part: "الآلي" } : { error: "تعذّر الحفظ." };
      }} names={Object.fromEntries((b.rosters ?? []).flatMap((r) => r.ids.map((id) => [id, (students.find((s) => s.id === id)?.full_name) ?? ""])))} onClose={() => setMode(null)} />}
      {mode === "scan" && <QuizScan quiz={quiz} questions={b.questions} students={students} subs={scanSubs} saveCard={noCard}
                                    onSave={onPaper} onAbsent={onAbsent} onClose={() => setMode(null)} />}
      {mode === "batch" && <QuizBatchScan quiz={quiz} questions={b.questions} students={students} subs={scanSubs} saveCard={noCard}
                                          onSave={onPaper} onAbsent={onAbsent} onClose={() => setMode(null)} />}
      {mode?.rubric && <RubricSheet student={mode.rubric} card={mode.card} prev={subs[mode.rubric.id]?.detail}
                                    onSave={async (crit) => { await storePractical(cls, mode.rubric.id, { rubric: crit.reduce((a, x) => a + x, 0), crit, card: mode.card.id }); setMode(null); }}
                                    onClose={() => setMode(null)} />}
      {mode?.manual && <ManualMark exam={exam} student={mode.manual} prev={subs[mode.manual.id]} onClose={() => setMode(null)}
                                   onSave={async (v) => { await store(cls, mode.manual.id, v === "absent" ? { absent: true, detail: { src: "manual" } }
                                     : { score: v, detail: { ...(subs[mode.manual.id]?.detail ?? {}), src: "manual" }, answers: subs[mode.manual.id]?.answers ?? null }); setMode(null); }} />}
    </div>
  );
}

function DeviceScan({ exam, onResult, names, onClose }) {
  const [last, setLast] = useState(null);
  const [count, setCount] = useState(0);
  const onCode = async (text) => {
    const res = readResultCode(text, exam);
    if (!res) { setLast({ error: "رمز غير صحيح أو لاختبار آخر." }); return; }
    const r = await onResult(res);
    if (r.ok) setCount((n) => n + 1);
    setLast(r.ok ? { ok: true, name: names[r.sid] || "طالب", score: r.score, part: r.part } : r);
  };
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas" dir="rtl">
      <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3">
        <p className="text-sm font-bold text-ink">مسح رموز الأجهزة · {exam.title}</p>
        <button type="button" className="btn-ghost py-1.5" onClick={onClose}>إنهاء</button>
      </div>
      <div className="mx-auto w-full max-w-md flex-1 space-y-3 overflow-y-auto p-4">
        <LabScanner onCode={onCode} />
        <p className="text-center text-xs text-muted">وجّه الكاميرا إلى رمز الطالب على شاشة الجهاز · رُصد <b className="num text-ink">{count}</b></p>
        {last && (last.error
          ? <p className="rounded-card bg-danger-light px-3 py-3 text-sm font-semibold text-absent">{last.error}</p>
          : <p className="rounded-card bg-present/10 px-3 py-3 text-sm font-semibold text-present">رُصد {last.name}: <span className="num">{last.score}</span>{last.part ? ` (${last.part})` : ` من ${exam.total}`}</p>)}
      </div>
    </div>
  );
}

function RubricSheet({ student, card, prev, onSave, onClose }) {
  const [vals, setVals] = useState(() => card.criteria.map((x, i) => (prev?.card === card.id && prev?.crit?.[i] != null ? prev.crit[i] : null)));
  const [busy, setBusy] = useState(false);
  const set = (i, v) => setVals(vals.map((x, j) => (j === i ? v : x)));
  const total = vals.reduce((a, x) => a + (x ?? 0), 0);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-card bg-paper p-4 sm:rounded-card" onClick={(e) => e.stopPropagation()}>
        <div><p className="text-sm font-bold text-ink">{student.full_name}</p><p className="text-[12px] text-muted">{card.title} · {card.app}</p></div>
        <p className="rounded-sm2 bg-canvas p-2.5 text-[12.5px] leading-relaxed text-ink">{card.task}</p>
        {card.criteria.map((x, i) => {
          const opts = [...new Set([0, Math.round(x.m / 2 * 2) / 2, x.m])];
          return (
            <div key={x.t} className="space-y-1.5 border-t border-line/60 pt-2">
              <p className="text-sm text-ink">{x.t} <span className="num text-[11px] text-muted">/ {x.m}</span></p>
              <div className="flex flex-wrap items-center gap-1.5">{opts.map((v) => (
                <button key={v} type="button" onClick={() => set(i, v)}
                        className={`num min-w-[3rem] rounded-pill px-3 py-1.5 text-sm ${vals[i] === v ? "bg-mint-deep font-bold text-white" : "border border-line bg-white text-ink"}`}>{v}</button>))}
                <input type="number" step="0.5" min={0} max={x.m} className="field num w-20 py-1.5 text-sm" value={vals[i] ?? ""}
                       onChange={(e) => set(i, e.target.value === "" ? null : Math.min(x.m, Math.max(0, Number(e.target.value))))} />
              </div>
            </div>);
        })}
        <div className="flex items-center gap-2 border-t border-line pt-3">
          <p className="flex-1 text-sm text-muted">المجموع <b className="num text-lg text-mint-deep">{total}</b> / <span className="num">{card.criteria.reduce((a, x) => a + x.m, 0)}</span></p>
          <button type="button" className="btn-ghost" onClick={onClose}>إلغاء</button>
          <button type="button" className="btn-primary" disabled={busy || vals.some((x) => x == null)} onClick={async () => { setBusy(true); await onSave(vals.map((x) => x ?? 0)); setBusy(false); }}>حفظ</button>
        </div>
      </div>
    </div>
  );
}

function ManualMark({ exam, student, prev, onSave, onClose }) {
  const [v, setV] = useState(prev?.score ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xs space-y-3 rounded-card bg-paper p-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-bold text-ink">{student.full_name}</p>
        <input type="number" step="0.5" min={0} max={exam.total} autoFocus className="field num text-center text-xl" value={v} onChange={(e) => setV(e.target.value)} />
        <p className="text-center text-[11px] text-muted">من <span className="num">{exam.total}</span>{exam.kind === "practical" ? " · تستبدل مجموع الجزأين" : ""}</p>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={() => onSave("absent")}>غائب</button>
          <button type="button" className="btn-primary flex-1" disabled={v === "" || Number(v) < 0 || Number(v) > exam.total} onClick={() => onSave(Math.round(Number(v) * 2) / 2)}>حفظ</button>
        </div>
      </div>
    </div>
  );
}
