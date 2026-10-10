import { nextHoliday } from "../lib/schoolTime";
import { fmtHijri } from "../lib/dates";
import { countAr } from "../lib/arabicCount";
import ExamCountdown from "./ExamCountdown.jsx";

/* =====================================================================
   شارات رأس الرئيسية: الإجازة القادمة (بلون بطاقة الإجازة) فوق شارة
   الاختبارات النهائية. كل شارة تختفي وحدها حين لا موعد قادم لها،
   وأثناء الإجازة نفسها تتولاها بطاقة الإجازة.
   ===================================================================== */
// الشارتان بعرض واحد: العمود بعرض أطولهما، وكل شارة تمتد لعرضه
export default function HeaderChips() {
  return (
    <div className="inline-flex max-w-full flex-col gap-1.5">
      <NextHolidayChip />
      <ExamCountdown />
    </div>
  );
}

function NextHolidayChip() {
  const h = nextHoliday();
  if (!h) return null;
  const when = h.days === 1 ? "غدًا" : `بعد ${countAr(h.days, "day", { acc: true })}`;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 rounded-pill border px-3 py-1 text-xs"
       style={{ background: "#002627", borderColor: "#002627", color: "#9FE3BE" }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
           strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
        <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      </svg>
      <span className="text-white">{h.name}</span>
      <b className="num font-bold">{when}</b>
      <span className="opacity-50">·</span>
      <span className="opacity-80">تبدأ <span className="num">{fmtHijri(h.start + "T12:00:00")}</span></span>
    </p>
  );
}
