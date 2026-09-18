import { useEffect, useState } from "react";
import { fmtGreg, fmtHijri } from "../lib/dates";

// موعد الاختبارات النهائية للفصل الدراسي الأول
// الأحد 1448/07/25هـ = الأحد 2027/01/03م (تم التحقق من التطابق)
const EXAM_DATE = new Date("2027-01-03T00:00:00+03:00");

function diffParts(target) {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes };
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
    const timer = setInterval(tick, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="rounded-card border border-[#CCF2DB] bg-mint-tint p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#6AA786]">
            العد التنازلي لموعد الاختبارات النهائية للفصل الدراسي الأول
          </p>
          <p className="mt-1 text-sm font-bold text-ink">
            الأحد الموافق <bdi dir="ltr">{fmtHijri(EXAM_DATE)}</bdi>
          </p>
          <p className="text-sm font-bold text-ink">
            <bdi dir="ltr">{fmtGreg(EXAM_DATE)}م</bdi>
          </p>
        </div>

        {parts ? (
          <div className="flex items-center gap-2">
            <Unit value={parts.days} label="يوم" />
            <Unit value={parts.hours} label="ساعة" />
            <Unit value={parts.minutes} label="دقيقة" />
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
