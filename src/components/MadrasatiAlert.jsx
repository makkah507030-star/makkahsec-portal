// src/components/MadrasatiAlert.jsx
// تنبيه الدخول لمنصة مدرستي عبر رابطها الرسمي وحده: انتشرت روابط غير رسمية تسبب مشكلات في الدخول.
// يظهر في «المنصات والدعم» برئيسية الطالب وولي الأمر، وفي مركز الدعم والمساندة.
export const MADRASATI_URL = "https://schools.madrasati.sa/";

export default function MadrasatiAlert({ className = "" }) {
  return (
    <div className={`flex items-start gap-3 rounded-card border border-[#EAD9AA] bg-[#FBF4E2] p-4 dark:border-[#5C4C22] dark:bg-[#2E2715] ${className}`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-sm2 bg-white text-[#9A7A2A] dark:bg-white/10 dark:text-[#E2C46F]">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="m9 12 2.2 2.2L15.5 10" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#2B2412] dark:text-[#F3E7C4]">تنبيه مهم: تأكد من الدخول لمنصة مدرستي عبر الرابط الرسمي فقط</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#4A4129] dark:text-[#DCCFA8]">
          انتشرت مؤخرًا روابط غير رسمية لمنصة مدرستي تسبب مشكلات متكررة في الدخول. احرص دائمًا على استخدام الرابط الرسمي فقط:{" "}
          <a href={MADRASATI_URL} target="_blank" rel="noopener noreferrer" dir="ltr"
             className="font-bold text-[#9A7A2A] underline underline-offset-2 dark:text-[#E2C46F]">schools.madrasati.sa</a>{" "}
          وللتأكد من صحة الموقع، تحقق من ظهور شارة <b className="text-[#9A7A2A] dark:text-[#E2C46F]">«موقع حكومي»</b> المسجّلة لدى هيئة الحكومة الرقمية أعلى الصفحة قبل إدخال أي بيانات.
        </p>
      </div>
    </div>
  );
}
