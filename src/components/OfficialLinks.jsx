// src/components/OfficialLinks.jsx
/* =====================================================================
   المنصات والدعم — في رئيسية الطالب وولي الأمر: منصة مدرستي ونظام نور بشعاريهما، وبوابة
   الدعم الفني لمنصة مدرستي التي تديرها المدرسة (ليست رسمية من المنصة). يفتح كلٌّ منها في
   تبويب جديد. الشعاران في public/brands/ (madrasati.png وnoor.png)؛ إن لم يوجد الشعار يظهر
   اسم النظام بلونه بدلًا منه.
   ===================================================================== */
import { useState } from "react";

const SYSTEMS = [
  { key: "madrasati", name: "منصة مدرستي", desc: "الدروس والواجبات والاختبارات والفصول الافتراضية",
    url: "https://schools.madrasati.sa/", logo: "/brands/madrasati.png", color: "#1B8354" },
  { key: "noor", name: "نظام نور", desc: "النتائج والشهادات والتسجيل وبيانات الطالب",
    url: "https://noor.moe.gov.sa/", logo: "/brands/noor.png", color: "#1D5C96" },
  { key: "support", name: "دعم منصة مدرستي", desc: "بوابة دعم من المدرسة لمشكلات منصة مدرستي: تذاكر ومتابعة ومصادر",
    url: "https://makkah507030.netlify.app/", icon: true, color: "#1B8354" },
];

function Logo({ s }) {
  const [ok, setOk] = useState(true);
  if (s.icon) return (
    <span className="grid h-12 w-24 place-items-center rounded-sm2 bg-mint-tint text-mint-deep">
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2v1ZM20 14a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2v1ZM17 16v1a3 3 0 0 1-3 3h-2" /></svg>
    </span>
  );
  return ok ? (
    <img src={s.logo} alt={s.name} className="h-12 w-24 object-contain" onError={() => setOk(false)} />
  ) : (
    <span className="grid h-12 w-24 place-items-center rounded-sm2 text-sm font-bold text-white" style={{ background: s.color }}>{s.name}</span>
  );
}

export default function OfficialLinks() {
  return (
    <section className="card p-4">
      <p className="text-sm font-bold text-ink">المنصات والدعم</p>
      <p className="text-xs text-muted">مدرستي ونور تسجّل الدخول فيهما بحسابك الرسمي (النفاذ الوطني)، ودعم مدرستي بوابة تديرها المدرسة لمساعدتك.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
