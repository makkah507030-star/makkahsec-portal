// src/components/NiepdLink.jsx
/* =====================================================================
   رابط «المعهد الوطني للتطوير المهني التعليمي» (منصة المستقبل: niepd.futurex.sa) —
   في صفحتي التطوير المهني (مجتمع التعلم ونماذج سجل التطوير المهني)، ليصل المعلم
   إلى البرامج التدريبية الرسمية ثم يوثّق مشاركته في البوابة. الشعار في public/brands/niepd.png.
   ===================================================================== */
import { useState } from "react";

const URL = "https://niepd.futurex.sa/";

export default function NiepdLink() {
  const [logo, setLogo] = useState(true);
  return (
    <a href={URL} target="_blank" rel="noopener noreferrer"
       className="flex items-center gap-3 rounded-card border border-line bg-white p-3 transition hover:border-mint-light hover:shadow-card">
      {logo
        ? <img src="/brands/niepd.png" alt="المعهد الوطني للتطوير المهني التعليمي" className="h-11 w-auto shrink-0 object-contain" onError={() => setLogo(false)} />
        : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mint-tint text-xs font-bold text-mint-deep">المعهد</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">المعهد الوطني للتطوير المهني التعليمي</span>
        <span className="block text-[11px] leading-snug text-muted">البرامج التدريبية الرسمية للمعلمين؛ سجّل فيها، ثم وثّق مشاركتك هنا لتُضاف لسجل تطويرك المهني.</span>
      </span>
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
    </a>
  );
}
