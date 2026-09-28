// src/components/Loader.jsx
// شعار البوابة المتحرك ومؤشر «جاري التحميل» الموحّد لكل الصفحات.
import { useEffect, useState } from "react";
import { loaderMounted } from "../lib/notice";

/** أيقونة البوابة: ثلاث طبقات تتراصّ وتنبض بالتتابع حين animate */
export function BrandMark({ size = 56, animate = true, className = "" }) {
  return (
    <svg viewBox="0 0 570 540" width={size} height={size} aria-hidden="true"
         className={`${animate ? "bm-anim" : ""} ${className}`}>
      <ellipse className="bm-shadow" cx="285" cy="518" rx="150" ry="11" fill="#3E6350" opacity=".12" />
      <polygon className="bm-l3" points="80,340 285,445 485,340 485,366 285,470 80,372"
               fill="#3E6350" stroke="#3E6350" strokeWidth="10" strokeLinejoin="round" />
      <polygon className="bm-l2" points="80,248 285,352 485,248 485,272 285,378 80,282"
               fill="#89D7AD" stroke="#89D7AD" strokeWidth="10" strokeLinejoin="round" />
      <polygon className="bm-l1" points="285,62 466,172 285,268 102,172"
               fill="#3E6350" stroke="#3E6350" strokeWidth="36" strokeLinejoin="round" />
    </svg>
  );
}

const HINTS = [
  { after: 4000, text: "لحظات من فضلك…" },
  { after: 10000, text: "الاتصال أبطأ من المعتاد، ما زلنا نعمل على طلبك." },
];

/** تلميح يتغيّر إن طال الانتظار — حتى لا يظن المستخدم أن الصفحة توقفت */
export function useWaitHint(on = true) {
  const [hint, setHint] = useState("");
  useEffect(() => {
    if (!on) return undefined;
    const timers = HINTS.map((h) => setTimeout(() => setHint(h.text), h.after));
    return () => { timers.forEach(clearTimeout); setHint(""); };
  }, [on]);
  return hint;
}

// بعد هذه المدة يُرفع الحجب عن الصفحة ويظهر المؤشر في مكانه — فلا يجمّد
// جزءٌ عالق البوابةَ كلها
const HAND_OFF_MS = 12000;

/**
 * جزء من الصفحة يُحمَّل. لا يُرسم شيء في مكانه: تُحجب الصفحة بتضليل خفيف
 * ويظهر شعار التحميل في صندوق وسط الشاشة (NoticeHost). وإن طال التحميل
 * يُرفع الحجب ويظهر مؤشر صغير هنا.
 *   <Loader />          مكان قسم أو صفحة
 *   <Loader compact />  سطر داخل بطاقة أو قائمة
 *   <Loader screen />   ملء الشاشة — عند فتح البوابة
 */
export default function Loader({ compact = false, screen = false, label = "جاري التحميل" }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (slow) return undefined;
    const release = loaderMounted();
    const t = setTimeout(() => setSlow(true), HAND_OFF_MS);
    return () => { clearTimeout(t); release(); };
  }, [slow]);

  const box = screen ? "min-h-screen" : compact ? "min-h-[2.5rem]" : "min-h-[30vh]";
  if (!slow) return <div className={box} aria-hidden="true" />;

  return (
    <div role="status" className={`ld-fade flex items-center justify-center gap-2 py-3 text-sm text-muted ${box}`}>
      <BrandMark size={compact ? 22 : 30} />
      <span>{label}<span className="ld-dots" /> <span className="text-xs text-faint">الاتصال أبطأ من المعتاد</span></span>
    </div>
  );
}
