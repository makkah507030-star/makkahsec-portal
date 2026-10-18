// src/pages/lab/LabLessons.jsx
// تبويب «الدروس»: دروس المعمل الرقمي يجرّبها المعلم كما يراها الطالب. التقدم هنا
// تجريبي على جهاز المعلم (localStorage)؛ والرصد للطلاب يأتي مع ملف المعمل والتكليف.
import { useState } from "react";
import { LESSONS, lessonById } from "../../lab-content/index.js";
import LessonPlayer, { lessonScore } from "./lessons/LessonPlayer.jsx";

const KEY = (id) => `lab-preview:${id}`;
const load = (id) => { try { return JSON.parse(localStorage.getItem(KEY(id)) || "{}"); } catch { return {}; } };
const save = (id, p) => { try { localStorage.setItem(KEY(id), JSON.stringify(p)); } catch { /* تجاهل */ } };

export default function LabLessons() {
  const [openId, setOpenId] = useState(null);
  const [progress, setProgress] = useState({});
  const [round, setRound] = useState(0);   // يزيد عند مسح التقدم فيبدأ المشغّل من جديد
  const lesson = openId && lessonById(openId);

  const open = (id) => { setProgress(load(id)); setOpenId(id); window.scrollTo({ top: 0 }); };
  const onProgress = (sid, score) => setProgress((p) => { const n = { ...p, [sid]: score }; save(openId, n); return n; });
  const reset = () => { save(openId, {}); setProgress({}); setRound((r) => r + 1); window.scrollTo({ top: 0 }); };

  if (lesson) {
    return (
      <LessonPlayer key={`${lesson.id}:${round}`} lesson={lesson} progress={progress}
                    onProgress={onProgress} onExit={() => setOpenId(null)}
                    footer={<button type="button" className="text-xs text-muted underline" onClick={reset}>مسح تقدّمي في هذا الدرس (تجربة المعلم)</button>} />
    );
  }

  // الدروس مجمّعة بالوحدة
  const units = [];
  LESSONS.forEach((l) => {
    let u = units.find((x) => x.no === l.unit.no && x.grade === l.grade);
    if (!u) units.push(u = { ...l.unit, grade: l.grade, lessons: [] });
    u.lessons.push(l);
  });

  return (
    <div className="space-y-4">
      <p className="rounded-card bg-canvas px-3 py-2 text-xs leading-relaxed text-muted">
        جرّب الدروس كما يراها الطالب: مفهوم، ثم تدريب عملي بتصحيح فوري، ثم اختبار. الدروس المعلّمة «مسودة» تُطابَق مع كتاب الوزارة قبل اعتمادها.
      </p>
      {units.map((u) => (
        <div key={`${u.grade}-${u.no}`} className="space-y-2">
          <p className="text-sm font-bold text-ink">{u.grade} · الوحدة {u.no}: {u.title}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {u.lessons.map((l) => {
              const s = lessonScore(l, load(l.id));
              return (
                <button key={l.id} type="button" onClick={() => open(l.id)}
                        className="card flex flex-col gap-2 p-4 text-start transition-shadow hover:shadow-lg">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold text-ink">الدرس {l.lesson.no}: {l.lesson.title}</span>
                    {l.draft && <span className="chip bg-warning-light text-late">مسودة</span>}
                  </div>
                  <span className="text-xs text-muted">{l.stations.length} محطات · صفحات <bdi className="num">{l.pages}</bdi></span>
                  <div className="h-1.5 rounded-pill bg-canvas">
                    <div className="h-1.5 rounded-pill bg-mint-deep" style={{ width: `${(s.done / s.total) * 100}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
