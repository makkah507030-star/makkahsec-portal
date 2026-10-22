// src/components/OfficialLinks.jsx
/* =====================================================================
   الأنظمة الرسمية — في رئيسية الطالب وولي الأمر: منصة مدرستي ونظام نور بشعاريهما،
   يفتح كلٌّ منهما في تبويب جديد. الشعاران في public/brands/ (madrasati.png وnoor.png)؛
   إن لم يوجد الشعار يظهر اسم النظام بلونه بدلًا منه.
   ===================================================================== */
import { useState } from "react";

const SYSTEMS = [
  { key: "madrasati", name: "منصة مدرستي", desc: "الدروس والواجبات والاختبارات والفصول الافتراضية",
    url: "https://schools.madrasati.sa/", logo: "/brands/madrasati.png", color: "#1B8354" },
  { key: "noor", name: "نظام نور", desc: "النتائج والشهادات والتسجيل وبيانات الطالب",
    url: "https://noor.moe.gov.sa/", logo: "/brands/noor.png", color: "#1D5C96" },
];

function Logo({ s }) {
  const [ok, setOk] = useState(true);
  return ok ? (
    <img src={s.logo} alt={s.name} className="h-12 w-24 object-contain" onError={() => setOk(false)} />
  ) : (
    <span className="grid h-12 w-24 place-items-center rounded-sm2 text-sm font-bold text-white" style={{ background: s.color }}>{s.name}</span>
  );
}

export default function OfficialLinks() {
  return (
    <section className="card p-4">
      <p className="text-sm font-bold text-ink">الأنظمة الرسمية</p>
      <p className="text-xs text-muted">تنتقل إليها من البوابة مباشرة، وتسجّل الدخول فيها بحسابك الرسمي (النفاذ الوطني).</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {SYSTEMS.map((s) => (
          <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-3 rounded-card border border-line bg-white p-3 transition hover:border-mint-light hover:shadow-card">
            <Logo s={s} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{s.name}</span>
              <span className="block text-[11px] leading-snug text-muted">{s.desc}</span>
            </span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
          </a>
        ))}
      </div>
    </section>
  );
}
