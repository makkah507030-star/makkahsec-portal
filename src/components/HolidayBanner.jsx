import { holidayToday } from "../lib/schoolTime";

/**
 * صندوق الإجازة الرسمية في الصفحة الرئيسية.
 * يظهر تلقائيًا فقط في تواريخ الإجازات المعرّفة في schoolTime.js (HOLIDAYS)،
 * ويعرض شعار المناسبة الرسمي (public/national-day.png) مع اسم الإجازة.
 * يختفي وحده بعد انتهاء الإجازة دون أي تدخّل.
 */
export default function HolidayBanner() {
  const name = holidayToday();
  if (!name) return null;

  return (
    <section
      className="overflow-hidden rounded-card"
      style={{ background: "#002627" }}
    >
      <img
        src="/national-day.png"
        alt="اليوم الوطني السعودي"
        className="mx-auto block w-full max-w-md px-4 pt-4"
      />
      <div className="px-5 pb-5 pt-2 text-center">
        <p className="text-base font-bold text-white">{name}</p>
        <p className="mt-1 text-sm" style={{ color: "#9FE3BE" }}>
          إجازة رسمية — لا توجد حصص ولا تحضير اليوم.
        </p>
      </div>
    </section>
  );
}
