// src/pages/lab/lessons/LessonPlayer.jsx
// مشغّل الدرس: شريط المحطات بإتقان كل منها، والمحطة الحالية، وملخص الدرس.
// التقدم يُحفظ بنسبة الإتقان الأولى لكل محطة (لا تُستبدل بإعادة المحاولة).
// لا يعتمد على البوابة: يأخذ progress وonProgress، فيعمل في ملف المعمل دون إنترنت أيضًا.
import { useState } from "react";
import { STATIONS } from "./stations.jsx";

const ICON = { concept: "📖", practice: "✍️", steps: "🖱️", quiz: "📝" };
const KIND = { concept: "مفهوم", practice: "تدريب", steps: "تطبيق على البرنامج", quiz: "اختبار" };

export function lessonScore(lesson, progress) {
  const graded = lesson.stations.filter((s) => s.type !== "concept");
  const quiz = lesson.stations.find((s) => s.type === "quiz");
  const vals = graded.filter((s) => s.type !== "quiz").map((s) => progress[s.id]).filter((v) => v != null);
  return {
    done: lesson.stations.filter((s) => progress[s.id] != null).length,
    total: lesson.stations.length,
    mastery: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
    quiz: quiz ? progress[quiz.id] ?? null : null,
  };
}

export default function LessonPlayer({ lesson, progress, onProgress, onExit, footer, actions }) {
  const first = lesson.stations.findIndex((s) => progress[s.id] == null);
  const [i, setI] = useState(first === -1 ? lesson.stations.length : first);
  const st = lesson.stations[i];
  const S = st && STATIONS[st.type];
  const sum = lessonScore(lesson, progress);

  const record = (score) => { if (progress[st.id] == null) onProgress(st.id, score); };

  return (
    <div className="space-y-4">
      {/* رأس الدرس */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted">
            {lesson.grade} · الوحدة {lesson.unit.no}: {lesson.unit.title} · صفحات <bdi className="num">{lesson.pages}</bdi>
          </p>
          <h2 className="text-lg font-bold text-ink">
            الدرس {lesson.lesson.no}: {lesson.lesson.title}
            {lesson.draft && <span className="chip mr-2 bg-warning-light align-middle text-late">مسودة</span>}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions}
          {onExit && <button type="button" className="btn-ghost py-2" onClick={onExit}>كل الدروس</button>}
        </div>
      </div>

      {/* شريط المحطات */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {lesson.stations.map((s, k) => {
          const v = progress[s.id];
          return (
            <button key={s.id} type="button" onClick={() => setI(k)} title={s.title}
                    className={`flex shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs transition-colors ${
                      k === i ? "border-mint-deep bg-mint-deep text-white" : v != null ? "border-present/40 bg-present/10 text-ink" : "border-line bg-paper text-muted"}`}>
              <span>{ICON[s.type]}</span>
              <span className="num">{k + 1}</span>
              {v != null && <span className={`num font-bold ${k === i ? "text-white" : "text-present"}`}>{s.type === "concept" ? "✓" : `${v}%`}</span>}
            </button>
          );
        })}
        <button type="button" onClick={() => setI(lesson.stations.length)}
                className={`shrink-0 rounded-pill border px-3 py-1.5 text-xs ${i === lesson.stations.length ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-paper text-muted"}`}>
          الملخص
        </button>
      </div>

      {/* المحطة */}
      {st ? (
        <div className="card space-y-4 p-4 sm:p-5">
          <div>
            <p className="text-[11px] font-semibold text-mint-deep">{ICON[st.type]} {KIND[st.type]} · المحطة <bdi className="num">{i + 1}</bdi> من <bdi className="num">{lesson.stations.length}</bdi></p>
            <h3 className="text-base font-bold text-ink">{st.title}</h3>
          </div>
          {S ? (
            <S key={st.id} st={st} result={progress[st.id] ?? null} onDone={record}
               onNext={() => setI(i + 1)} />
          ) : <p className="text-sm text-absent">نوع محطة غير معروف: {st.type}</p>}
        </div>
      ) : (
        <div className="card space-y-4 p-4 sm:p-5">
          <h3 className="text-base font-bold text-ink">ملخص الدرس</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-card bg-canvas p-3"><p className="num text-xl font-bold text-ink">{sum.done}/{sum.total}</p><p className="text-[11px] text-muted">محطات منجزة</p></div>
            <div className="rounded-card bg-canvas p-3"><p className="num text-xl font-bold text-ink">{sum.mastery ?? "—"}{sum.mastery != null && "%"}</p><p className="text-[11px] text-muted">إتقان التدريبات</p></div>
            <div className="rounded-card bg-canvas p-3"><p className="num text-xl font-bold text-ink">{sum.quiz ?? "—"}{sum.quiz != null && "%"}</p><p className="text-[11px] text-muted">اختبار الدرس</p></div>
          </div>
          <ul className="divide-y divide-line/60 rounded-card border border-line/60">
            {lesson.stations.map((s, k) => (
              <li key={s.id}>
                <button type="button" onClick={() => setI(k)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-canvas">
                  <span>{ICON[s.type]}</span>
                  <span className="flex-1 text-ink">{s.title}</span>
                  <span className={`num text-xs font-bold ${progress[s.id] != null ? "text-present" : "text-faint"}`}>
                    {progress[s.id] == null ? "لم تُنجز" : s.type === "concept" ? "✓" : `${progress[s.id]}%`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {lesson.objectives?.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-muted">أهداف الدرس</p>
              <ul className="list-disc space-y-0.5 pr-5 text-sm text-ink">{lesson.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
            </div>
          )}
          {footer}
        </div>
      )}
    </div>
  );
}
