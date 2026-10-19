// src/pages/activities/games/TeamsQuiz.jsx
// مسابقة الفرق على السبورة: من فريقين إلى أربعة، سؤال بخيارات ومؤقت، والمعلم يمنح النقطة
// للفريق الذي أجاب أولًا. الأسئلة من بيانات البطاقة: { questions: [{ q, options, answer }] }.
import { useEffect, useMemo, useState } from "react";
import { CUP_COLORS } from "../../../lib/activities.js";

const LTR = ["أ", "ب", "ج", "د"];
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const NAMES = ["الصقور", "النمور", "الفرسان", "النجوم"];

export default function TeamsQuiz({ data }) {
  const questions = useMemo(() => shuffle(data?.questions ?? []), [data]);
  const [teams, setTeams] = useState(null);       // [{ name, color, score }]
  const [n, setN] = useState(2);
  const [secs, setSecs] = useState(30);
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);
  const [left, setLeft] = useState(null);

  useEffect(() => {
    if (left == null || left <= 0 || show) return;
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [left, show]);

  if (!questions.length) return <p className="p-6 text-center text-muted">لا أسئلة في هذه البطاقة.</p>;

  if (!teams) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <div className="card space-y-4 p-5">
          <p className="text-lg font-bold text-ink">إعداد المسابقة</p>
          <label className="block text-sm text-muted">عدد الفرق
            <div className="mt-1 flex gap-2">
              {[2, 3, 4].map((k) => <button key={k} type="button" onClick={() => setN(k)}
                className={`flex-1 rounded-pill py-2 font-bold ${n === k ? "bg-mint-deep text-white" : "border border-line"}`}>{k}</button>)}
            </div>
          </label>
          <label className="block text-sm text-muted">وقت السؤال (ثانية)
            <input type="number" min={0} max={120} className="field num mt-1" value={secs} onChange={(e) => setSecs(Number(e.target.value) || 0)} />
          </label>
          <p className="text-xs text-muted"><bdi className="num">{questions.length}</bdi> سؤالًا بترتيب عشوائي.</p>
          <button type="button" className="btn-primary w-full" onClick={() => {
            setTeams(Array.from({ length: n }, (_, k) => ({ name: NAMES[k], color: CUP_COLORS[k], score: 0 })));
            setLeft(secs || null);
          }}>ابدأ المسابقة</button>
        </div>
      </div>
    );
  }

  const q = questions[i];
  const over = i >= questions.length;
  const next = () => { setI((x) => x + 1); setShow(false); setLeft(secs || null); };
  const award = (k) => { setTeams((t) => t.map((x, j) => (j === k ? { ...x, score: x.score + 1 } : x))); next(); };
  const top = Math.max(...teams.map((t) => t.score));

  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[1fr_280px]">
      <div className="card flex min-h-[60vh] flex-col justify-center space-y-6 p-6 sm:p-10">
        {over ? (
          <div className="space-y-3 text-center">
            <p className="text-6xl">🏆</p>
            <p className="text-3xl font-bold text-ink">
              {teams.filter((t) => t.score === top).map((t) => t.name).join(" و")} {teams.filter((t) => t.score === top).length > 1 ? "بالتعادل!" : "الفائز!"}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm text-muted">
              <span>السؤال <bdi className="num">{i + 1}</bdi> من <bdi className="num">{questions.length}</bdi></span>
              {left != null && <span className={`num rounded-pill px-4 py-1 text-2xl font-bold ${left <= 5 ? "bg-absent text-white" : "bg-mint-tint text-mint-deep"}`}>{left}</span>}
            </div>
            <p className="text-center text-3xl font-bold leading-relaxed text-ink sm:text-4xl">{q.q}</p>
            <div className={`grid gap-3 ${q.options.length > 2 ? "sm:grid-cols-2" : "grid-cols-2"}`}>
              {q.options.map((o, k) => (
                <div key={k} className={`flex items-center gap-3 rounded-card border-2 px-4 py-3 text-2xl font-semibold ${
                  show && k === q.answer ? "border-present bg-present text-white" : show ? "border-line text-faint" : "border-line text-ink"}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-canvas text-lg font-bold text-ink">{LTR[k]}</span>
                  {o}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {!show && <button type="button" className="btn-primary px-6" onClick={() => setShow(true)}>إظهار الإجابة</button>}
              {show && teams.map((t, k) => (
                <button key={k} type="button" className="rounded-pill px-5 py-2 font-bold text-white" style={{ background: t.color }} onClick={() => award(k)}>+1 {t.name}</button>
              ))}
              {show && <button type="button" className="btn-ghost" onClick={next}>لا أحد</button>}
            </div>
          </>
        )}
      </div>
      <div className="space-y-2">
        {teams.map((t, k) => (
          <div key={k} className="card flex items-center gap-3 p-3" style={{ borderInlineStartWidth: 6, borderInlineStartColor: t.color }}>
            <input className="min-w-0 flex-1 bg-transparent text-lg font-bold text-ink outline-none" value={t.name}
                   onChange={(e) => setTeams((x) => x.map((y, j) => (j === k ? { ...y, name: e.target.value } : y)))} />
            <span className="num text-3xl font-bold text-ink">{t.score}</span>
          </div>
        ))}
        <button type="button" className="btn-ghost w-full text-sm" onClick={() => { setTeams(null); setI(0); setShow(false); }}>مسابقة جديدة</button>
      </div>
    </div>
  );
}
