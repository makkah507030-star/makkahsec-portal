// src/pages/lab/lessons/stations.jsx
// أنواع المحطات: المفهوم (شرائح وسؤال تحقق)، والتدريب العملي (مهام بأداة)،
// والخطوات (محاكاة برنامج)، والاختبار. كل محطة تنتهي بنسبة إتقان 0–100 عبر onDone.
//
// الإتقان: المهمة الصحيحة من أول محاولة بلا تلميح = 1، الصحيحة بعد خطأ أو تلميح = ½،
// وما أُظهر حله = 0. ومحطة الخطوات: الخطوات المنفّذة بلا خطأ ÷ عددها.
import { useState } from "react";
import { Rich, Figure, Question, isCorrect, isAnswered } from "./parts.jsx";
import { WIDGETS } from "./widgets.jsx";
import { MOCKS } from "./mocks.jsx";

const pct = (x) => Math.round(x * 100);

function Done({ score, text, onNext, nextLabel }) {
  return (
    <div className="rounded-card border border-present/30 bg-present/10 p-4 text-center">
      <p className="text-base font-bold text-present">أنجزت المحطة ✓</p>
      {text && <p className="mt-1 text-sm text-ink">{text}</p>}
      <p className="mt-1 text-sm text-muted">نسبة الإتقان <bdi className="num font-bold text-ink">{score}%</bdi></p>
      {onNext && <button type="button" className="btn-primary mt-3" onClick={onNext}>{nextLabel ?? "المحطة التالية"}</button>}
    </div>
  );
}

/* ----------------------------- المفهوم ----------------------------- */
export function ConceptStation({ st, onDone, result, onNext }) {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState(null);
  const [checked, setChecked] = useState(false);
  const [tries, setTries] = useState(0);
  const slides = st.slides ?? [];
  const onCheck = i >= slides.length;
  const slide = slides[i];

  const check = () => {
    const ok = isCorrect(st.check, ans);
    setTries((n) => n + 1);
    if (ok) { setChecked(true); onDone(tries === 0 ? 100 : 50); } else setChecked("wrong");
  };

  if (result != null && (checked === true || (!st.check && onCheck))) return <Done score={result} onNext={onNext} />;

  return (
    <div className="space-y-4">
      {!onCheck ? (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-mint-deep">{slide.title}</h3>
          <Rich text={slide.text} className="text-[15px] text-ink" />
          <Figure figure={slide.figure} />
        </div>
      ) : st.check ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted">تحقق من فهمك</p>
          <Question q={st.check} value={ans} onChange={(v) => { setAns(v); if (checked === "wrong") setChecked(false); }} seed={st.id} />
          {checked === "wrong" && <p className="text-sm text-absent">ليست الإجابة الصحيحة — راجع الشرح وحاول مرة أخرى.</p>}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn-ghost py-2" disabled={i === 0} onClick={() => setI(i - 1)}>السابق</button>
        <span className="num text-xs text-muted">{Math.min(i + 1, slides.length)} / {slides.length}</span>
        {!onCheck
          ? <button type="button" className="btn-primary py-2" onClick={() => { if (i + 1 >= slides.length && !st.check) onDone(100); setI(i + 1); }}>
              {i + 1 < slides.length ? "التالي" : st.check ? "تحقق من فهمك" : "إنهاء"}
            </button>
          : <button type="button" className="btn-primary py-2" disabled={!isAnswered(st.check, ans)} onClick={check}>تحقق</button>}
      </div>
    </div>
  );
}

/* ----------------------------- التدريب العملي ----------------------------- */
export function PracticeStation({ st, onDone, result, onNext }) {
  const W = WIDGETS[st.widget];
  const [k, setK] = useState(0);
  const [value, setValue] = useState(() => W?.initial(st.tasks[0]));
  const [wrong, setWrong] = useState(0);
  const [hint, setHint] = useState(false);
  const [state, setState] = useState(null);     // null | "ok" | "solved"
  const [scores, setScores] = useState([]);
  const task = st.tasks[k];
  const finished = scores.length === st.tasks.length;

  if (!W) return <p className="text-sm text-absent">أداة غير معروفة: {st.widget}</p>;
  if (finished || (result != null && k === 0 && !scores.length)) {
    return <Done score={finished ? pct(scores.reduce((a, b) => a + b, 0) / scores.length) : result} onNext={onNext} />;
  }

  const grade = (s) => setScores((list) => {
    const next = [...list, s];
    if (next.length === st.tasks.length) onDone(pct(next.reduce((a, b) => a + b, 0) / next.length));
    return next;
  });
  const check = () => {
    if (W.check(task, value)) { setState("ok"); grade(wrong === 0 && !hint ? 1 : 0.5); }
    else setWrong((n) => n + 1);
  };
  const solve = () => { setValue(W.solve(task)); setState("solved"); grade(0); };
  const next = () => {
    const n = k + 1;
    if (n < st.tasks.length) { setK(n); setValue(W.initial(st.tasks[n])); setWrong(0); setHint(false); setState(null); }
  };

  return (
    <div className="space-y-4">
      {k === 0 && !state && <Rich text={st.intro} className="text-sm text-muted" />}
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-semibold text-ink">{W.prompt(task)}</p>
        <span className="num shrink-0 rounded-pill bg-canvas px-2.5 py-0.5 text-xs text-muted">{k + 1} / {st.tasks.length}</span>
      </div>
      <W.Input task={task} value={value} setValue={setValue} disabled={!!state} />
      {wrong > 0 && !state && <p className="text-sm text-absent">ليست صحيحة — حاول مرة أخرى{wrong >= 2 ? "، أو اطلب التلميح" : ""}.</p>}
      {(hint || state === "solved") && (
        <div className="rounded-card bg-warning-light/70 px-3 py-2 text-sm text-ink">
          {W.hint(task).map((h, i) => <p key={i} className="leading-relaxed">{h}</p>)}
        </div>
      )}
      {state === "ok" && <p className="rounded-card bg-present/10 px-3 py-2 text-sm font-semibold text-present">إجابة صحيحة ✓</p>}
      <div className="flex flex-wrap items-center gap-2">
        {!state ? (
          <>
            <button type="button" className="btn-primary py-2" onClick={check}>تحقق</button>
            {!hint && <button type="button" className="btn-ghost py-2" onClick={() => setHint(true)}>تلميح</button>}
            {wrong >= 2 && <button type="button" className="ms-auto text-xs text-muted underline" onClick={solve}>إظهار الحل</button>}
          </>
        ) : k + 1 < st.tasks.length ? (
          <button type="button" className="btn-primary py-2" onClick={next}>المهمة التالية</button>
        ) : null}
      </div>
    </div>
  );
}

/* ----------------------------- الخطوات (محاكاة برنامج) ----------------------------- */
export function StepsStation({ st, onDone, result, onNext }) {
  const Mock = MOCKS[st.mock];
  const [k, setK] = useState(0);
  const [state, setState] = useState(() => ({ ...st.start }));
  const [miss, setMiss] = useState(false);       // خطأ في الخطوة الحالية
  const [clean, setClean] = useState(0);         // خطوات بلا خطأ
  const [hint, setHint] = useState(false);
  const step = st.steps[k];
  const finished = k >= st.steps.length;

  if (!Mock) return <p className="text-sm text-absent">محاكاة غير معروفة: {st.mock}</p>;

  const onHit = (id) => {
    if (finished) return;
    if (id !== step.target) { setMiss(true); return; }
    const c = clean + (miss || hint ? 0 : 1);
    setClean(c);
    if (step.set) setState((s) => ({ ...s, ...step.set }));
    setMiss(false); setHint(false);
    if (k + 1 >= st.steps.length) onDone(pct(c / st.steps.length));
    setK(k + 1);
  };

  return (
    <div className="space-y-4">
      {k === 0 && <Rich text={st.intro} className="text-sm text-muted" />}
      {!finished ? (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-mint-deep/30 bg-mint-tint px-3 py-2">
          <span className="num rounded-pill bg-mint-deep px-2 py-0.5 text-xs font-bold text-white">{k + 1} / {st.steps.length}</span>
          <p className="flex-1 text-sm font-semibold text-ink">{step.say}</p>
          {!hint && <button type="button" className="text-xs font-semibold text-mint-deep underline" onClick={() => setHint(true)}>أين؟</button>}
        </div>
      ) : (
        <Done score={result ?? pct(clean / st.steps.length)} text={st.done} onNext={onNext} />
      )}
      {miss && !finished && <p className="text-sm text-absent">ليس هذا — اقرأ الخطوة وحاول مرة أخرى، أو اضغط «أين؟».</p>}
      <Mock state={state} onHit={onHit} hint={hint && !finished ? step.target : null} />
    </div>
  );
}

/* ----------------------------- الاختبار ----------------------------- */
export function QuizStation({ st, onDone, result, onNext }) {
  const [ans, setAns] = useState({});
  const [score, setScore] = useState(null);
  const all = st.questions.every((q, i) => isAnswered(q, ans[i]));

  const submit = () => {
    const s = pct(st.questions.filter((q, i) => isCorrect(q, ans[i])).length / st.questions.length);
    setScore(s); onDone(s);
  };
  const shown = score ?? null;

  return (
    <div className="space-y-4">
      {result != null && shown == null && (
        <p className="rounded-card bg-canvas px-3 py-2 text-sm text-muted">أدّيت الاختبار من قبل ونتيجتك <bdi className="num font-bold text-ink">{result}%</bdi>. يمكنك أداؤه مرة أخرى للتدريب، وتبقى النتيجة الأولى.</p>
      )}
      {st.questions.map((q, i) => (
        <div key={i} className="rounded-card border border-line/70 p-3">
          <span className="num mb-1 inline-block rounded-pill bg-canvas px-2 py-0.5 text-[11px] text-muted">{i + 1}</span>
          <Question q={q} value={ans[i]} onChange={(v) => setAns((a) => ({ ...a, [i]: v }))} reveal={shown != null} seed={`${st.id}:${i}`} />
        </div>
      ))}
      {shown == null ? (
        <button type="button" className="btn-primary w-full" disabled={!all} onClick={submit}>
          {all ? "تسليم الاختبار" : `أجب عن كل الأسئلة (${st.questions.filter((q, i) => isAnswered(q, ans[i])).length} / ${st.questions.length})`}
        </button>
      ) : (
        <div className={`rounded-card p-4 text-center ${shown >= (st.pass ?? 70) ? "bg-present/10" : "bg-warning-light"}`}>
          <p className="text-lg font-bold text-ink">نتيجتك <bdi className="num">{shown}%</bdi></p>
          <p className="text-sm text-muted">{shown >= (st.pass ?? 70) ? "اجتزت اختبار الدرس" : `درجة الاجتياز ${st.pass ?? 70}% — راجع المحطات ثم أعد الاختبار`}</p>
          <div className="mt-3 flex justify-center gap-2">
            <button type="button" className="btn-ghost py-2" onClick={() => { setAns({}); setScore(null); }}>إعادة الاختبار</button>
            {onNext && <button type="button" className="btn-primary py-2" onClick={onNext}>ملخص الدرس</button>}
          </div>
        </div>
      )}
    </div>
  );
}

export const STATIONS = { concept: ConceptStation, practice: PracticeStation, steps: StepsStation, quiz: QuizStation };
