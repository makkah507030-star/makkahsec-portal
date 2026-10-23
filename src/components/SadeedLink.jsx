// src/components/SadeedLink.jsx
/* =====================================================================
   رابط «منصة سديد» (هيئة تقويم التعليم والتدريب: sadeed.etec.gov.sa) — تحت بند الرخصة
   المهنية (e02_09) في ملف الأداء الوظيفي، ليحمّل المعلم رخصته منها ثم يرفعها شاهدًا.
   الشعار في public/brands/sadeed.svg.
   ===================================================================== */
import { useState } from "react";

const URL = "https://sadeed.etec.gov.sa/auth/signin";

export default function SadeedLink() {
  const [logo, setLogo] = useState(true);
  return (
    <a href={URL} target="_blank" rel="noopener noreferrer"
       className="mt-2 flex max-w-md items-center gap-3 rounded-card border border-line bg-white p-2.5 transition hover:border-mint-light hover:shadow-card">
      {logo
        ? <img src="/brands/sadeed.svg" alt="منصة سديد" className="h-9 w-auto shrink-0 object-contain" onError={() => setLogo(false)} />
        : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint-tint text-xs font-bold text-mint-deep">سديد</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">منصة سديد</span>
        <span className="block text-[11px] leading-snug text-muted">ادخل للمنصة وحمّل رخصتك المهنية، ثم ارفعها هنا شاهدًا.</span>
      </span>
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
    </a>
  );
}
