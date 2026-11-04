// src/components/DutyGuide.jsx
// المناوبة في الوصف الوظيفي للمعلم (البند 28 في دليل الوزارة): ملخصها، ووقتها في اليوم من أوقات الحصص في البوابة
// (قبل الاصطفاف الصباحي بربع ساعة، وبعد نهاية الدوام بما لا يزيد عن نصف ساعة)، وصورة البند من الدليل.
// compact: سطر الوقت وحده (لبطاقة المناوبة في الرئيسية).
import { useEffect, useState } from "react";
import { loadPeriodTimes, toMinutes } from "../lib/periodTimes";
import { dayStartMinutes } from "../lib/officialAttendance";
import { PERIODS_PER_DAY } from "../lib/schoolTime";

const fm = (m) => {
  if (m == null) return "—";
  const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0");
  return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? "ص" : "م"}`;
};

export function useDutyWindow(dow) {
  const [w, setW] = useState(null);
  useEffect(() => {
    if (!dow) { setW(null); return; }
    loadPeriodTimes().then(({ rows }) => {
      const start = dayStartMinutes(rows);
      const last = (rows ?? []).filter((r) => r.kind === "period" && r.period_no && r.period_no <= (PERIODS_PER_DAY[dow] ?? 7) && r.end_time)
        .map((r) => toMinutes(r.end_time)).sort((a, b) => b - a)[0];
      setW({ from: start != null ? start - 15 : null, dayStart: start, dayEnd: last ?? null, to: last != null ? last + 30 : null });
    }).catch(() => setW(null));
  }, [dow]);
  return w;
}

export default function DutyGuide({ dow, compact = false }) {
  const w = useDutyWindow(dow);
  const [img, setImg] = useState(false);
  const times = w && w.from != null && w.to != null
    ? <>من <b dir="rtl" className="whitespace-nowrap">{fm(w.from)}</b> قبل الاصطفاف بربع ساعة، حتى <b dir="rtl" className="whitespace-nowrap">{fm(w.to)}</b> بعد نهاية الدوام بنصف ساعة</>
    : null;
  if (compact) return times ? <p className="mt-1 text-[12.5px] leading-relaxed text-muted">وقت المناوبة اليوم: {times}.</p> : null;
  return (
    <div className="card space-y-2 border-r-4 border-r-[#E0A800] p-4">
      <p className="text-sm font-bold text-ink">المناوبة في الوصف الوظيفي للمعلم <span className="text-[11.5px] font-normal text-muted">· دليل الوزارة، البند 28</span></p>
      <ul className="list-disc space-y-1 pr-5 text-[13px] leading-relaxed text-muted">
        <li>تبدأ المناوبة والإشراف على الطلاب قبل الاصطفاف الصباحي بـ<b className="text-ink">15 دقيقة</b>، وتمتد بعد نهاية الدوام بما <b className="text-ink">لا يزيد عن 30 دقيقة</b>.</li>
        <li>وفق الجدول المعد من اللجنة الإدارية والمعتمد من مدير المدرسة.</li>
        {times && <li className="text-ink">اليوم: {times}.</li>}
      </ul>
      <button type="button" className="text-[12px] font-semibold text-mint-deep hover:underline" onClick={() => setImg((v) => !v)}>
        {img ? "إخفاء البند من الدليل" : "عرض البند من الدليل"}</button>
      {img && <img src="/docs/duty-28.jpg" alt="البند 28 من الوصف الوظيفي للمعلم: أعمال المناوبة والإشراف" className="w-full rounded-sm2 border border-line" loading="lazy" />}
    </div>
  );
}
