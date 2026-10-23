// src/pages/qudrat/SadeedGuide.jsx
/* =====================================================================
   «التسجيل في الاختبارات عبر منصة سديد» — في مركز التدريب للطالب: رابط المنصة بشعارها
   وخطوات حجز اختبار القدرات العامة أو التحصيلي. تُطوى الخطوات وتُفتح عند الحاجة.
   ===================================================================== */
import { useState } from "react";

const SIGNIN = "https://sadeed.etec.gov.sa/auth/signin";
const PAPER = "https://etec.gov.sa/ar/eservices-catalogue/individual/s-96826f99-17ae-4280-9f6a-891295862f62";
const A = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-mint-deep underline underline-offset-2">{children}</a>
);

export default function SadeedGuide() {
  const [logo, setLogo] = useState(true);
  return (
    <section className="card overflow-hidden">
      <a href={SIGNIN} target="_blank" rel="noopener noreferrer"
         className="flex items-center gap-3 p-3.5 transition hover:bg-canvas">
        {logo
          ? <img src="/brands/sadeed.svg" alt="منصة سديد" className="h-10 w-auto shrink-0 object-contain" onError={() => setLogo(false)} />
          : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mint-tint text-xs font-bold text-mint-deep">سديد</span>}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">التسجيل في الاختبارات (سديد)</span>
          <span className="block text-[11.5px] leading-snug text-muted">احجز اختبار القدرات العامة أو التحصيلي من هيئة تقويم التعليم والتدريب.</span>
        </span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
      </a>
      <details className="group border-t border-line/60">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-semibold text-mint-deep">
          خطوات التسجيل في الاختبار
          <span className="text-faint transition group-open:rotate-180">▾</span>
        </summary>
        <ol className="list-decimal space-y-1.5 pb-4 pe-4 ps-9 text-[13px] leading-relaxed text-ink">
          <li>ادخل إلى الموقع الرسمي عبر <A href={SIGNIN}>منصة سديد</A>، أو من بوابة <A href={PAPER}>التسجيل في الاختبار الورقي</A>.</li>
          <li>سجّل الدخول عبر النفاذ الوطني الموحد، أو برقم الهوية أو الإقامة وكلمة المرور.</li>
          <li>اذهب إلى قسم «الخدمات»، ثم اختر بطاقة «الاختبارات» وتفاصيل خدمة التسجيل.</li>
          <li>حدّد الاختبار المطلوب: القدرات العامة (ورقي أو رقمي) أو التحصيلي.</li>
          <li>اختر الموعد والمقر المناسبين، ثم اضغط «حجز الاختبار».</li>
          <li>أتمّ الدفع بإحدى الوسائل المتاحة: سداد أو فيزا أو ماستر كارد أو Apple Pay.</li>
        </ol>
      </details>
    </section>
  );
}
