// src/pages/lab/lessons/LessonPresenter.jsx
// وضع العرض على السبورة: الدرس نفسه الذي يؤدّيه الطلاب، مقسّمًا شاشات (شريحة، سؤال،
// مهمة تدريب، محاكاة) بخط كبير، يتنقّل بينها المعلم بالأزرار أو بلوحة المفاتيح وجهاز
// التحكم (الأسهم وPageUp/PageDown والمسافة)، ويُظهر الإجابة متى شاء (R). لا رصد ولا درجات.
// لا يعتمد على البوابة، فيعمل أيضًا في نسخة العرض المنزّلة دون إنترنت.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rich, Figure, Question } from "./parts.jsx";
import { WIDGETS } from "./widgets.jsx";
import { MOCKS } from "./mocks.jsx";

const ICON = { concept: "📖", practice: "✍️", steps: "🖱️", quiz: "📝" };
const ZOOMS = [1, 1.15, 1.3, 1.5, 1.75, 2];

/* الدرس شاشات متتالية */
function framesOf(lesson) {
  const out = [];
  lesson.stations.forEach((st) => {
    if (st.type === "concept") {
      (st.slides ?? []).forEach((slide) => out.push({ st, kind: "slide", slide }));
      if (st.check) out.push({ st, kind: "question", q: st.check, label: "تحقق من فهمك" });
    } else if (st.type === "practice") {
      st.tasks.forEach((task, k) => out.push({ st, kind: "task", task, label: `المهمة ${k + 1} من ${st.tasks.length}` }));
    } else if (st.type === "steps") {
      out.push({ st, kind: "steps" });
    } else if (st.type === "quiz") {
      st.questions.forEach((q, k) => out.push({ st, kind: "question", q, label: `السؤال ${k + 1} من ${st.questions.length}` }));
    }
  });
  return out;
}

/* الإجابة الصحيحة بصيغة قيمة السؤال، فيلوّنها Question عند الإظهار */
const answerOf = (q) => (q.kind === "match" ? Object.fromEntries(q.pairs.map((_, i) => [i, i]))
  : q.kind === "input" ? q.answer[0] : q.answer);

export default function LessonPresenter({ lesson, onExit, badge }) {
  const frames = useMemo(() => framesOf(lesson), [lesson]);
  const [i, setI] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [zoom, setZoom] = useState(2);
  const root = useRef(null);
  const f = frames[i];

  const go = useCallback((d) => { setI((n) => Math.min(frames.length - 1, Math.max(0, n + d))); setReveal(false); }, [frames.length]);
  const full = () => (document.fullscreenElement ? document.exitFullscreen?.() : root.current?.requestFullscreen?.());

  // شاشة جديدة: لا تبقى خانة مُركَّزًا عليها (بعض الأدوات تركّز تلقائيًا) فيعمل جهاز التحكم
  useEffect(() => { document.activeElement?.blur?.(); }, [i]);

  // لوحة المفاتيح وجهاز التحكم بالعرض؛ أثناء الكتابة في خانة يعمل PageUp/PageDown فقط
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && !["pageup", "pagedown"].includes(k)) return;
      if (["arrowleft", "pagedown", " "].includes(k)) { e.preventDefault(); go(1); }
      else if (["arrowright", "pageup"].includes(k)) { e.preventDefault(); go(-1); }
      else if (k === "r" || k === "ق") setReveal((v) => !v);
      else if (k === "f" || k === "ب") full();
      else if (k === "+" || k === "=") setZoom((z) => Math.min(ZOOMS.length - 1, z + 1));
      else if (k === "-") setZoom((z) => Math.max(0, z - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <div ref={root} className="fixed inset-0 z-50 flex flex-col bg-canvas" dir="rtl">
      {/* الرأس */}
      <div className="flex items-center gap-3 border-b border-line bg-paper px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">{lesson.grade} · الدرس {lesson.lesson.no}: {lesson.lesson.title}</p>
          <p className="truncate text-base font-bold text-ink">{ICON[f.st.type]} {f.st.title}{f.label && <span className="mr-2 text-sm font-normal text-muted">· {f.label}</span>}</p>
        </div>
        {badge}
        <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setZoom((z) => Math.max(0, z - 1))} title="تصغير (-)">أ−</button>
        <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} title="تكبير (+)">أ+</button>
        <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={full} title="ملء الشاشة (F)">⛶</button>
        {onExit && <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => { if (document.fullscreenElement) document.exitFullscreen?.(); onExit(); }}>خروج</button>}
      </div>
      <div className="h-1 bg-line/50"><div className="h-1 bg-mint-deep transition-all" style={{ width: `${((i + 1) / frames.length) * 100}%` }} /></div>

      {/* الشاشة */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-6 py-6" style={{ zoom: ZOOMS[zoom] }}>
          <Frame key={i} f={f} reveal={reveal} />
        </div>
      </div>

      {/* التنقل */}
      <div className="flex items-center gap-2 border-t border-line bg-paper px-4 py-2">
        <button type="button" className="btn-ghost py-2" disabled={i === 0} onClick={() => go(-1)}>السابق</button>
        <span dir="ltr" className="num flex-1 text-center text-sm text-muted">{i + 1} / {frames.length}</span>
        {(f.kind === "question" || f.kind === "task") && (
          <button type="button" className={reveal ? "btn-ghost py-2" : "btn-ghost py-2 text-mint-deep"} onClick={() => setReveal((v) => !v)}>
            {reveal ? "إخفاء الإجابة" : "إظهار الإجابة"}
          </button>
        )}
        <button type="button" className="btn-primary py-2" disabled={i === frames.length - 1} onClick={() => go(1)}>التالي</button>
      </div>
    </div>
  );
}

function Frame({ f, reveal }) {
  if (f.kind === "slide") {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-mint-deep">{f.slide.title}</h2>
        <Rich text={f.slide.text} className="text-lg text-ink" />
        <Figure figure={f.slide.figure} />
      </div>
    );
  }
  if (f.kind === "question") return <QuestionFrame f={f} reveal={reveal} />;
  if (f.kind === "task") return <TaskFrame st={f.st} task={f.task} reveal={reveal} />;
  if (f.kind === "steps") return <StepsFrame st={f.st} />;
  return null;
}

/* سؤال: يختار المعلم إجابة الطلاب، وعند الإظهار يُلوَّن الصحيح (والخطأ إن اختير) */
function QuestionFrame({ f, reveal }) {
  const [value, setValue] = useState(undefined);
  const shown = reveal && (value == null || value === "" || f.q.kind === "match") ? answerOf(f.q) : value;
  return (
    // الإجابة الصحيحة أوضح على جهاز العرض من تلوينها المعتاد
    <div className="space-y-3 text-lg [&_.border-present]:border-2 [&_.border-present]:bg-present/25 [&_.border-present]:font-bold">
      <Question q={f.q} value={shown} onChange={setValue} reveal={reveal} seed={`${f.st.id}:${f.q.q}`} />
    </div>
  );
}

/* مهمة تدريب: يجرّبها المعلم أمام الطلاب، ويتحقق من إجابتهم، ويُظهر التلميح والحل */
function TaskFrame({ st, task, reveal }) {
  const W = WIDGETS[st.widget];
  const [value, setValue] = useState(() => W.initial(task));
  const [res, setRes] = useState(null);
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (reveal) { setValue(W.solve(task)); setHint(true); setRes("ok"); }
  }, [reveal, W, task]);

  return (
    <div className="space-y-4">
      <Rich text={st.intro} className="text-sm text-muted" />
      <p className="text-2xl font-semibold text-ink">{W.prompt(task)}</p>
      <W.Input task={task} value={value} setValue={(v) => { setValue(v); setRes(null); }} disabled={false} />
      {res && <p className={`rounded-card px-3 py-2 font-semibold ${res === "ok" ? "bg-present/10 text-present" : "bg-danger-light text-absent"}`}>{res === "ok" ? "إجابة صحيحة ✓" : "ليست صحيحة ✗"}</p>}
      {hint && (
        <div className="rounded-card bg-warning-light/70 px-4 py-3 text-ink">
          {W.hint(task).map((h, k) => <p key={k} className="leading-relaxed">{h}</p>)}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary py-2" onClick={() => setRes(W.check(task, value) ? "ok" : "no")}>تحقق</button>
        <button type="button" className="btn-ghost py-2" onClick={() => setHint((h) => !h)}>{hint ? "إخفاء التلميح" : "تلميح"}</button>
        <button type="button" className="btn-ghost py-2" onClick={() => { setValue(W.initial(task)); setRes(null); setHint(false); }}>مسح</button>
      </div>
    </div>
  );
}

/* محاكاة البرنامج: الخطوة الحالية مكتوبة، والعنصر المطلوب مُبرَز، ويُنفّذها المعلم بالضغط */
function StepsFrame({ st }) {
  const Mock = MOCKS[st.mock];
  const [k, setK] = useState(0);
  const [state, setState] = useState(() => ({ ...st.start }));
  const [where, setWhere] = useState(true);
  const step = st.steps[k];
  const advance = () => { if (step.set) setState((s) => ({ ...s, ...step.set })); setK(k + 1); };
  const reset = () => { setK(0); setState({ ...st.start }); };

  return (
    <div className="space-y-4">
      <Rich text={st.intro} className="text-sm text-muted" />
      {step ? (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-mint-deep/30 bg-mint-tint px-4 py-3">
          <span className="num rounded-pill bg-mint-deep px-2.5 py-0.5 text-sm font-bold text-white">{k + 1} / {st.steps.length}</span>
          <p className="flex-1 text-xl font-semibold text-ink">{step.say}</p>
        </div>
      ) : <p className="rounded-card bg-present/10 px-4 py-3 text-xl font-semibold text-present">{st.done ?? "اكتملت الخطوات ✓"}</p>}
      <Mock state={state} onHit={(id) => { if (step && id === step.target) advance(); }} hint={where && step ? step.target : null} />
      <div className="flex flex-wrap gap-2">
        {step && <button type="button" className="btn-primary py-2" onClick={advance}>نفّذ الخطوة</button>}
        <button type="button" className="btn-ghost py-2" onClick={() => setWhere((w) => !w)}>{where ? "إخفاء التلميح" : "أين؟"}</button>
        <button type="button" className="btn-ghost py-2" onClick={reset}>من البداية</button>
      </div>
    </div>
  );
}
