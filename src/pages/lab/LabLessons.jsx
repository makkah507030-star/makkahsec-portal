// src/pages/lab/LabLessons.jsx
// تبويب «الدروس»: دروس المعمل الرقمي يجرّبها المعلم كما يراها الطالب. التقدم هنا
// تجريبي على جهاز المعلم (localStorage)؛ والرصد للطلاب يأتي مع ملف المعمل والتكليف.
import { useState } from "react";
import { LESSONS, lessonById } from "../../lab-content/index.js";
import LessonPlayer, { lessonScore } from "./lessons/LessonPlayer.jsx";
import LabSessions from "./LabSessions.jsx";
import LessonPresenter from "./lessons/LessonPresenter.jsx";
import { buildLabFile, downloadText } from "./labFile.js";
import { notify } from "../../lib/notice";
import { PLAN, PLAN_GRADES, currentPlanItem, weeksOfLesson, weeksLabel } from "../../lab-content/plan.js";

const shortD = (d) => `${+d.slice(8, 10)}/${+d.slice(5, 7)}`;

/* بند في الخطة: درس يُفتح، أو نشاط نصي */
function PlanItem({ item, onOpen }) {
  const l = lessonById(item);
  if (!l) return <span className="rounded-pill bg-canvas px-2.5 py-1 text-xs text-muted">{item}</span>;
  return (
    <button type="button" onClick={() => onOpen(l.id)}
            className="rounded-pill border border-mint-light bg-mint-tint px-2.5 py-1 text-xs font-semibold text-mint-deep hover:bg-mint-light">
      الوحدة {l.unit.no} · الدرس {l.lesson.no}: {l.lesson.title}
    </button>
  );
}

/* توزيع المنهج: الأسبوع الحالي لكل صف، والتوزيع كاملًا عند الطلب */
function LabPlan({ onOpen }) {
  const [all, setAll] = useState(false);
  const cur = currentPlanItem();
  const Row = ({ w, current }) => (
    <div className={`grid gap-2 border-t border-line/60 px-3 py-2.5 sm:grid-cols-[9rem_1fr_1fr] ${current ? "bg-mint-tint/50" : ""}`}>
      <div className="text-xs">
        <b className="text-ink">{w.no ? `الأسبوع ${w.no}` : w.break ?? "الاختبارات"}</b>
        <span className="num block text-muted" dir="ltr">{shortD(w.from)} – {shortD(w.to)}</span>
      </div>
      {w.no ? ["g10", "g12"].map((g) => (
        <div key={g} className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-faint sm:hidden">{PLAN_GRADES[g].grade}:</span>
          {w[g].map((x) => <PlanItem key={x} item={x} onOpen={onOpen} />)}
        </div>
      )) : <p className="text-xs font-semibold text-late sm:col-span-2">{w.break ?? w.exams}</p>}
      {w.note && <p className="text-[11px] text-late sm:col-start-2 sm:col-span-2">{w.note}</p>}
    </div>
  );
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-ink">توزيع المنهج · الفصل الدراسي الأول 1448هـ</h2>
          <p className="text-[11.5px] text-muted">توزيع وزارة التعليم الخاص بالمنطقة الغربية · {PLAN_GRADES.g10.subject} و{PLAN_GRADES.g12.subject}</p>
        </div>
        <button type="button" className="text-xs font-semibold text-mint-deep" onClick={() => setAll(!all)}>{all ? "الأسبوع الحالي فقط" : "التوزيع كاملًا"}</button>
      </div>
      <div className="hidden grid-cols-[9rem_1fr_1fr] gap-2 bg-canvas px-3 py-1.5 text-[11px] font-semibold text-muted sm:grid">
        <span>الأسبوع</span><span>{PLAN_GRADES.g10.grade}</span><span>{PLAN_GRADES.g12.grade}</span>
      </div>
      {all ? PLAN.map((w) => <Row key={w.from} w={w} current={w === cur} />)
        : cur ? <Row w={cur} current /> : <p className="border-t border-line/60 px-4 py-3 text-xs text-muted">انتهى الفصل الدراسي الأول.</p>}
    </section>
  );
}

const KEY = (id) => `lab-preview:${id}`;
const load = (id) => { try { return JSON.parse(localStorage.getItem(KEY(id)) || "{}"); } catch { return {}; } };
const save = (id, p) => { try { localStorage.setItem(KEY(id), JSON.stringify(p)); } catch { /* تجاهل */ } };

export default function LabLessons({ lab, canCreate }) {
  const [openId, setOpenId] = useState(null);
  const [progress, setProgress] = useState({});
  const [round, setRound] = useState(0);   // يزيد عند مسح التقدم فيبدأ المشغّل من جديد
  const [presenting, setPresenting] = useState(false);
  const lesson = openId && lessonById(openId);

  const open = (id) => { setProgress(load(id)); setOpenId(id); window.scrollTo({ top: 0 }); };
  const onProgress = (sid, score) => setProgress((p) => { const n = { ...p, [sid]: score }; save(openId, n); return n; });
  const reset = () => { save(openId, {}); setProgress({}); setRound((r) => r + 1); window.scrollTo({ top: 0 }); };

  // نسخة العرض المنزّلة: ملف واحد يفتحه المعلم على جهاز السبورة دون إنترنت
  const downloadPresent = async () => {
    try {
      const html = await buildLabFile({ mode: "present", lesson: lesson.id, title: `عرض: ${lesson.lesson.title}` });
      downloadText(html, `عرض-${lesson.lesson.title}.html`);
    } catch (e) { notify({ ok: false, text: "تعذّر تجهيز الملف: " + e.message }); }
  };

  if (lesson && presenting) return <LessonPresenter lesson={lesson} onExit={() => setPresenting(false)} />;
  if (lesson) {
    return (
      <LessonPlayer key={`${lesson.id}:${round}`} lesson={lesson} progress={progress}
                    actions={<>
                      <button type="button" className="btn-primary py-2" onClick={() => setPresenting(true)}>عرض على السبورة</button>
                      <button type="button" className="btn-ghost py-2" onClick={downloadPresent}>تنزيل نسخة العرض</button>
                    </>}
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
      <LabPlan onOpen={open} />
      <LabSessions lab={lab} canCreate={canCreate} />
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
                  <span className="text-xs text-muted">{l.stations.length} محطات · صفحات <bdi className="num">{l.pages}</bdi>{weeksOfLesson(l.id).length > 0 && <> · {weeksLabel(weeksOfLesson(l.id))}</>}</span>
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
