import { useEffect, useState } from "react";
import { fmtDate, fmtHijri } from "../lib/dates";
import { countAr } from "../lib/arabicCount";

// موعد الاختبارات النهائية للفصل الدراسي الأول
// الأحد 25/07/1448 = الأحد 03/01/2027 (تم التحقق من التطابق)
const EXAM_DATE = new Date("2027-01-03T00:00:00+03:00");

const daysLeft = () => {
  const ms = EXAM_DATE.getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / (1000 * 60 * 60 * 24)) : 0;
};

/* =====================================================================
   العد التنازلي للاختبارات النهائية.
   • في الرئيسيات (الافتراضي): شارة صغيرة في رأس الصفحة بدل بطاقة كاملة،
     يشتد لونها كلما اقترب الموعد، وتختفي حين تبدأ الاختبارات
     (أيام الاختبار نفسها تعرضها بطاقة «يوم الاختبار»).
   • variant="card": البطاقة الكاملة للصفحة العامة.
   ===================================================================== */
export default function ExamCountdown({ variant = "chip" }) {
  const [days, setDays] = useState(daysLeft);

  useEffect(() => {
    // تُحسب بالأيام فقط، فلا داعي لتحديث كل دقيقة — كل ساعة كافٍ
    const timer = setInterval(() => setDays(daysLeft()), 60 * 60000);
    return () => clearInterval(timer);
  }, []);

  if (variant === "card") return <CountdownCard days={days} />;
  if (!days) return null;

  const tone = days <= 3 ? "border-absent/25 bg-absent/5 text-absent"
    : days <= 14 ? "border-warning/30 bg-warning-light text-warning"
    : "border-[#CCF2DB] bg-mint-tint text-mint-deep";
  const when = days === 1 ? "غدًا" : `بعد ${countAr(days, "day", { acc: true })}`;

  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 rounded-pill border px-3 py-1 text-xs ${tone}`}
       title={`الأحد ${fmtDate(EXAM_DATE)}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
           strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0"><path d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4" /></svg>
      <span>الاختبارات النهائية</span>
      <b className="num font-bold">{when}</b>
      <span className="opacity-50">·</span>
      <span className="opacity-75">الأحد <span className="num">{fmtHijri(EXAM_DATE)}</span></span>
    </p>
  );
}

function CountdownCard({ days }) {
  return (
    <section className="rounded-card border border-[#CCF2DB] bg-mint-tint p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#6AA786]">
            العد التنازلي لموعد الاختبارات النهائية للفصل الدراسي الأول
          </p>
          <p className="mt-1 text-sm font-bold text-ink">الأحد {fmtDate(EXAM_DATE)}</p>
        </div>
        {days ? (
          <div className="min-w-[64px] rounded-lg bg-white px-3 py-2 text-center shadow-sm">
            <p className="num text-2xl font-bold leading-none text-mint-deep">{days}</p>
            <p className="mt-1 text-[11px] text-muted">يوم متبقٍ</p>
          </div>
        ) : (
          <p className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-mint-deep shadow-sm">
            بدأت الاختبارات النهائية، وفّقكم الله
          </p>
        )}
      </div>
    </section>
  );
}
