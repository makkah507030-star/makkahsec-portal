// src/components/QuizScan.jsx
import { useMemo, useRef, useState } from "react";
import { cardLayout, rowsToAnswers } from "../lib/omrLayout.js";
import { imageFromFile, readCard } from "../lib/omrReader.js";

/* =====================================================================
   التصحيح بكاميرا الجوال.
   المعلم يصوّر بطاقة إجابة كل طالب، فتُقرأ الدوائر المظلَّلة داخل الجهاز
   (لا تُرفع الصورة لأي خادم)، ثم يراجع القراءة ويصحّح أي صف مُعلَّم،
   ويحفظ — فتُصحَّح الإجابات بنفس مسار الرصد اليدوي، وينتقل للطالب التالي.
   ===================================================================== */

const AR_LTRS = ["أ", "ب", "ج", "د", "هـ"];
const STATUS = {
  ok:    null,
  faint: { t: "تظليل باهت — تأكّد", c: "bg-warning/10 text-warning" },
  multi: { t: "أكثر من دائرة — اختر", c: "bg-absent/10 text-absent" },
  blank: { t: "لم يُظلَّل", c: "bg-canvas text-muted" },
};

export default function QuizScan({ quiz, questions, students, subs, startId, onSave, onAbsent, onClose }) {
  const ltr = quiz?.lang === "en";
  const layout = useMemo(() => cardLayout(questions, { ltr }), [questions, ltr]);

  const [idx, setIdx] = useState(() => Math.max(0, students.findIndex((s) => s.id === startId)));
  const student = students[idx];
  const [stage, setStage] = useState("capture");     // capture | reading | review
  const [result, setResult] = useState(null);
  const [picks, setPicks] = useState({});
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);           // رسالة آخر حفظ
  const [busy, setBusy] = useState(false);
  const camRef = useRef(null);
  const galRef = useRef(null);

  const existing = student ? subs[student.id] : null;

  const reset = () => { setStage("capture"); setResult(null); setPicks({}); setError(null); };

  const goNext = () => {
    // الطالب التالي الذي لم يُرصد بعد؛ وإن لم يوجد فالتالي في القائمة
    const after = students.slice(idx + 1).findIndex((s) => !subs[s.id]);
    const next = after >= 0 ? idx + 1 + after : idx + 1;
    if (next >= students.length) { onClose(); return; }
    setIdx(next); reset();
  };

  const onFile = async (file) => {
    if (!file) return;
    setStage("reading"); setError(null); setSaved(null);
    try {
      const img = await imageFromFile(file);
      // نترك للمتصفح فرصة لعرض «جارٍ القراءة» قبل المعالجة
      await new Promise((r) => setTimeout(r, 30));
      const r = readCard(img, layout);
      if (!r.ok) { setError(r.error); setStage("capture"); return; }
      setResult(r); setPicks(r.picks); setStage("review");
    } catch (e) {
      setError(e?.message || "تعذّرت قراءة الصورة."); setStage("capture");
    }
  };

  const toggle = (key, k) => setPicks((p) => ({ ...p, [key]: p[key] === k ? null : k }));

  const flagged = result ? result.rows.filter((r) => r.status !== "ok" && picks[r.key] === r.pick) : [];
  const unresolved = result ? result.rows.filter((r) => r.status === "multi" && picks[r.key] == null) : [];

  const save = async () => {
    setBusy(true);
    const answers = rowsToAnswers(layout.rows, picks);
    const fresh = await onSave(student, answers);
    setBusy(false);
    setSaved(fresh?.score != null
      ? `حُفظ ${student.full_name}: ${fresh.score} / ${quiz?.total_marks}`
      : `حُفظ ${student.full_name}.`);
    goNext();
  };

  const absent = async () => {
    setBusy(true);
    await onAbsent(student);
    setBusy(false);
    setSaved(`سُجّل غياب ${student.full_name}.`);
    goNext();
  };

  if (!student) return null;
  const done = students.filter((s) => subs[s.id]).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas" dir="rtl">
      {/* الشريط العلوي */}
      <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3">
        <button onClick={onClose} className="text-sm font-semibold text-muted">إغلاق</button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-bold text-ink">{student.full_name}</p>
          <p className="text-[11px] text-muted">
            الطالب <span className="num">{idx + 1}</span> من <span className="num">{students.length}</span>
            {" · "}رُصد <span className="num">{done}</span>
          </p>
        </div>
        <div className="flex gap-1">
          <button disabled={idx === 0 || busy} onClick={() => { setIdx(idx - 1); reset(); }}
                  className="rounded-pill border border-line px-2.5 py-1 text-xs text-muted disabled:opacity-40">السابق</button>
          <button disabled={busy} onClick={() => { if (idx + 1 < students.length) { setIdx(idx + 1); reset(); } }}
                  className="rounded-pill border border-line px-2.5 py-1 text-xs text-muted">تخطٍّ</button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 space-y-3 overflow-y-auto p-4">
        {saved && <p className="rounded-card bg-present/10 px-3 py-2 text-sm text-present">{saved}</p>}

        {stage !== "review" && (
          <section className="card space-y-3 p-5 text-center">
            {existing && (
              <p className="rounded-sm2 bg-warning/10 px-3 py-2 text-xs text-warning">
                {existing.absent ? "مسجّل غائبًا" : `مرصود مسبقًا (${existing.score ?? "—"} / ${quiz?.total_marks})`}
                {" — "}التصوير الجديد يستبدل الرصد السابق.
              </p>
            )}
            <p className="text-sm text-muted">
              صوّر <b className="text-ink">بطاقة الإجابة</b> من الأعلى، بحيث تظهر
              <b className="text-ink"> المربعات السوداء الأربعة</b> كاملة، وبإضاءة جيدة بلا ظل.
            </p>
            {error && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{error}</p>}

            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
                   onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            <input ref={galRef} type="file" accept="image/*" className="hidden"
                   onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />

            <button className="btn-primary w-full py-3 text-base" disabled={stage === "reading"}
                    onClick={() => camRef.current?.click()}>
              {stage === "reading" ? "جارٍ قراءة البطاقة…" : "📷 تصوير البطاقة"}
            </button>
            <div className="flex gap-2">
              <button className="flex-1 rounded-pill border border-line py-2 text-sm text-muted"
                      disabled={stage === "reading"} onClick={() => galRef.current?.click()}>
                اختيار صورة محفوظة
              </button>
              <button className="flex-1 rounded-pill border border-absent/40 py-2 text-sm font-semibold text-absent"
                      disabled={busy} onClick={absent}>
                غائب
              </button>
            </div>
            <p className="text-[11px] text-faint">تُقرأ الصورة داخل جهازك ولا تُرفع لأي خادم.</p>
          </section>
        )}

        {stage === "review" && result && (
          <>
            <section className="card overflow-hidden p-2">
              <img src={result.preview} alt="البطاقة كما قُرئت" className="w-full rounded-sm2" />
              <p className="px-2 pt-2 text-[11px] text-muted">
                تأكّد أن الاسم في البطاقة هو <b className="text-ink">{student.full_name}</b>.
                الدوائر المُحاطة بالأخضر هي ما قُرئ.
              </p>
            </section>

            {(flagged.length > 0 || unresolved.length > 0) ? (
              <p className="rounded-card bg-warning/10 px-3 py-2 text-sm text-warning">
                راجع الصفوف المُعلَّمة أدناه (<span className="num">{result.rows.filter((r) => r.status !== "ok").length}</span>)،
                واضغط الدائرة الصحيحة لتعديلها.
              </p>
            ) : (
              <p className="rounded-card bg-present/10 px-3 py-2 text-sm text-present">
                قُرئت كل الصفوف بوضوح.
              </p>
            )}

            <section className="card divide-y divide-line overflow-hidden">
              {layout.rows.map((lr) => {
                const r = result.rows.find((x) => x.key === lr.key);
                const st = STATUS[r.status];
                const letters = lr.kind === "truefalse" ? ["صح", "خطأ"] : AR_LTRS;
                return (
                  <div key={lr.key} className={`flex items-center gap-2 px-3 py-2 ${st ? "bg-warning/5" : ""}`}>
                    <span className="num w-16 shrink-0 text-xs font-bold text-muted">{lr.label}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-1.5">
                        {lr.bubbles.map((_, k) => (
                          <button key={k} onClick={() => toggle(lr.key, k)}
                            className={`grid h-9 min-w-9 place-items-center rounded-full border px-2 text-xs font-bold transition-colors ${
                              picks[lr.key] === k ? "border-mint-deep bg-mint-deep text-white"
                                                  : "border-line bg-white text-muted"}`}>
                            {letters[k] ?? k + 1}
                          </button>
                        ))}
                      </div>
                      {st && <span className={`chip mt-1.5 inline-block text-[10px] ${st.c}`}>{st.t}</span>}
                    </div>
                  </div>
                );
              })}
            </section>

            <div className="sticky bottom-0 flex gap-2 bg-canvas pb-2 pt-1">
              <button className="btn-primary flex-1 py-3" disabled={busy} onClick={save}>
                {busy ? "جارٍ الحفظ…" : "حفظ وتصحيح ← التالي"}
              </button>
              <button className="rounded-pill border border-line px-4 text-sm text-muted" disabled={busy}
                      onClick={reset}>
                إعادة التصوير
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

