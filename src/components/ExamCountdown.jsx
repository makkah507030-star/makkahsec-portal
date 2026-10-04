import { useEffect, useState } from "react";
import { fmtDate } from "../lib/dates";

// موعد الاختبارات النهائية للفصل الدراسي الأول
// الأحد 25/07/1448 = الأحد 03/01/2027 (تم التحقق من التطابق)
const EXAM_DATE = new Date("2027-01-03T00:00:00+03:00");

function diffParts(target) {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return { days };
}

function Unit({ value, label }) {
  return (
    <div className="min-w-[64px] rounded-lg bg-white px-3 py-2 text-center shadow-sm">
      <p className="num text-2xl font-bold leading-none text-mint-deep">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{label}</p>
    </div>
  );
}

export default function ExamCountdown() {
  const [parts, setParts] = useState(() => diffParts(EXAM_DATE));

  useEffect(() => {
    const tick = () => setParts(diffParts(EXAM_DATE));
    tick();
    // تُحسب بالأيام فقط، فلا داعي لتحديث كل دقيقة — كل ساعة كافٍ
    const timer = setInterval(tick, 60 * 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="rounded-card border border-[#CCF2DB] bg-mint-tint p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#6AA786]">
            العد التنازلي لموعد الاختبارات النهائية للفصل الدراسي الأول
          </p>
          <p className="mt-1 text-sm font-bold text-ink">
            الأحد {fmtDate(EXAM_DATE)}
          </p>
        </div>

        {parts ? (
          <div className="flex items-center gap-2">
            <Unit value={parts.days} label="يوم متبقٍ" />
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
