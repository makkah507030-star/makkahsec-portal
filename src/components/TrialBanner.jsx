// src/components/TrialBanner.jsx
import { Link } from "react-router-dom";
import { holidayToday, todayISO } from "../lib/schoolTime";

/* شريط أعلى البوابة:
   في اليوم الوطني يتحوّل إلى شريط احتفائي أخضر بألوان الهوية،
   ثم يعود تلقائيًا إلى شريط «نسخة تجريبية» بعد انقضائه.

   يُكتشف الموسم الوطني بطريقتين، فيظهر ولو لم يُسجَّل في التقويم:
   ١) إجازة مفعّلة في «التقويم والإجازات» يحوي اسمها «الوطني».
   ٢) الفترة من ٢٣ إلى ٢٨ سبتمبر ميلادي. */
const NATIONAL_FROM = 23;   // بداية العرض في سبتمبر
const NATIONAL_TO   = 28;   // آخر يوم يظهر فيه الشريط

function isNationalDay() {
  const h = holidayToday();
  if (h?.name && h.name.includes("الوطني")) return true;
  const [, m, d] = todayISO().split("-");
  const day = Number(d);
  return m === "09" && day >= NATIONAL_FROM && day <= NATIONAL_TO;
}

function NationalDayBanner() {
  return (
    <div
      className="text-white"
      style={{
        background: "linear-gradient(90deg,#3E6350 0%,#4E7A62 45%,#6AA786 100%)",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2.5 gap-y-1 px-5 py-2.5 text-center text-xs leading-relaxed sm:text-sm">
        <span className="font-bold">اليوم الوطني السعودي</span>
        <span className="opacity-50">·</span>
        <span className="font-semibold text-[#CCF2DB]">عزنا بطبعنا</span>
        <span className="opacity-50">·</span>
        <span className="opacity-95">
          نحتفي بمسيرةٍ من العز والفخر لوطننا
        </span>
      </div>
    </div>
  );
}

export default function TrialBanner() {
  if (isNationalDay()) return <NationalDayBanner />;

  return (
    <div className="bg-[#9A7B22] text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-5 py-2.5 text-center text-xs leading-relaxed sm:text-sm">
        <span className="font-semibold">نسخة تجريبية</span>
        <span className="opacity-60">·</span>
        <span className="opacity-95">
          البوابة قيد التجربة وسيبدأ العمل بها رسميًا قريبًا، وقد تتغيّر البيانات أو الخصائص خلال هذه المرحلة.
        </span>
        <Link
          to="/contact"
          className="font-semibold underline underline-offset-2 hover:opacity-80"
        >
          مركز الدعم والمساندة
        </Link>
      </div>
    </div>
  );
}
