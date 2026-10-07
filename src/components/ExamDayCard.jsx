// src/components/ExamDayCard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { fmtDate } from "../lib/dates";
import { todayISO } from "../lib/schoolTime";
import { loadExamContext, loadNextExamDay, daysPhrase } from "../lib/examScope.js";

/* =====================================================================
   بطاقة «اختبارات اليوم» في الصفحة الرئيسية — بحسب الجدول المنشور:
   الطالب مواد فصله، وولي الأمر مواد كل ابن، والمعلم موادّه في فصوله.
   تعرض اختبارات اليوم، وإلا أقرب يوم اختبار خلال أسبوع، وتختفي فيما سوى ذلك.
   ===================================================================== */

const SHOW_WITHIN_DAYS = 7;

const weekday = (iso) =>
  new Date(iso + "T12:00:00").toLocaleDateString("ar-SA", { weekday: "long", timeZone: "Asia/Riyadh" });

export default function ExamDayCard() {
  const { session, effectiveRole } = useSession();
  const uid = session?.user?.id;
  const [day, setDay] = useState(null);
  const [multi, setMulti] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    (async () => {
      try {
        const ctx = await loadExamContext(uid, effectiveRole);
        const next = await loadNextExamDay(ctx);
        if (!alive) return;
        setMulti(ctx.scopes.length > 1 || effectiveRole === "teacher");
        setDay(next);
      } catch { /* البطاقة اختيارية — لا تُعطّل الصفحة */ }
    })();
    return () => { alive = false; };
  }, [uid, effectiveRole]);

  if (!day) return null;
  const n = Math.round((new Date(day.date + "T00:00:00") - new Date(todayISO() + "T00:00:00")) / 86400000);
  if (n > SHOW_WITHIN_DAYS) return null;
  const today = n === 0;

  return (
    <section className={`overflow-hidden rounded-card border bg-white ${today ? "border-warning/50" : "border-[#CCF2DB]"}`}>
      <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${today ? "bg-warning/10" : "bg-mint-tint"}`}>
        <div className="min-w-0">
          <p className={`text-sm font-bold ${today ? "text-warning" : "text-mint-deep"}`}>
            {today ? "اختبارات اليوم" : `اختبارات ${weekday(day.date)} — ${daysPhrase(n)}`}
          </p>
          <p className="num mt-0.5 text-xs text-muted">{today && `${weekday(day.date)} `}{fmtDate(day.date)}</p>
        </div>
        <Link to="/exams" className="shrink-0 text-xs font-semibold text-mint-deep hover:underline">
          الجدول كاملًا ←
        </Link>
      </div>

      <ul className="divide-y divide-line">
        {day.items.map(({ scope, slot, final }) => (
          <li key={`${scope.key}-${slot.id}`} className="flex items-center gap-3 px-4 py-2.5">
            <span className="grid h-9 min-w-[2.75rem] shrink-0 place-items-center rounded-sm2 bg-canvas px-1.5 text-center text-[11px] font-semibold leading-tight text-muted">
              {final
                ? (slot.period_no === 2 ? "الفترة الثانية" : "الفترة الأولى")
                : <span>الحصة <span className="num">{slot.period_no}</span></span>}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{slot.subject_name}</p>
              {multi && <p className="truncate text-xs text-muted">{scope.label}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
