// src/components/TrialBanner.jsx
import { Link } from "react-router-dom";
import { holidayToday, todayISO } from "../lib/schoolTime";

/* شريط أعلى البوابة:
   • للمسجّلين: تلقي الاقتراحات والملاحظات والشكاوى.
   • للزوار (variant="support"): من تعثّر دخوله يُوجَّه إلى مركز الدعم.
   • في اليوم الوطني يتحوّل شريط المسجّلين إلى شريط احتفائي أخضر، ثم يعود تلقائيًا.

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

/* شريط الدعم للزوار (الصفحة الرئيسية وصفحة الدخول): بلون الشريط الذهبي نفسه،
   يدلّ من تعثّر دخوله على مركز الدعم والمساندة — يُرسل طلبه دون حساب. */
function SupportBanner() {
  return (
    <div className="bg-[#9A7B22] text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-5 py-2.5 text-center text-xs leading-relaxed sm:text-sm">
        <span className="font-semibold">تواجه صعوبة في الدخول إلى البوابة؟</span>
        <span className="opacity-60">·</span>
        <span className="opacity-95">
          فريق الدعم الفني في خدمتك — أرسل طلبك باسمك ورقم جوالك دون الحاجة إلى تسجيل الدخول، ونتواصل معك.
        </span>
        <Link
          to="/contact"
          className="whitespace-nowrap rounded-pill bg-white/15 px-3 py-0.5 font-semibold transition-colors hover:bg-white/25"
        >
          مركز الدعم والمساندة ←
        </Link>
      </div>
    </div>
  );
}

/** variant="support": شريط الدعم للزوار بدل الشريط الافتراضي */
export default function TrialBanner({ variant }) {
  if (variant === "support") return <SupportBanner />;
  if (isNationalDay()) return <NationalDayBanner />;

  // للمسجّلين: شريط لتلقي الاقتراحات والملاحظات والشكاوى
  return (
    <div className="bg-[#9A7B22] text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-5 py-2.5 text-center text-xs leading-relaxed sm:text-sm">
        <span className="font-semibold">رأيك يصنع الفرق</span>
        <span className="opacity-60">·</span>
        <span className="opacity-95">
          نسعد باستقبال اقتراحاتكم وملاحظاتكم وشكاواكم، لنطوّر البوابة ونرتقي بخدماتها معًا.
        </span>
        <Link
          to="/contact?type=suggestion"
          className="whitespace-nowrap rounded-pill bg-white/15 px-3 py-0.5 font-semibold transition-colors hover:bg-white/25"
        >
          شاركنا رأيك ←
        </Link>
      </div>
    </div>
  );
}
