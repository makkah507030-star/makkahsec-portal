// src/components/StudentHeader.jsx
import { useState } from "react";
import HeaderChips from "./HeaderChips.jsx";
import { GRADE_NAMES } from "../lib/schoolTime";
import iconMint from "../assets/icon-mint.png";
import iconWhite from "../assets/icon-white.png";

/* =====================================================================
   بطاقة الطالب أعلى الرئيسية للطالب وولي أمره، بهوية استوديو البوابة الرسمية
   (studio/studio.css: .stu-light و.stu-dark): خلفية بخطوط مائلة وهالة ومكعبين،
   وشريط البوابة، ورمز الطالب، والاسم، والصف والفصل. فاتحة أو غامقة، ويُتذكّر الاختيار.
   ===================================================================== */

// الاسم كما في نور قد يحمل شرطة أو مسافات زائدة في طرفيه
export const cleanName = (n) => String(n ?? "").replace(/^[\s\-–—_.]+|[\s\-–—_.]+$/g, "").replace(/\s+/g, " ");

const THEMES = {
  light: { bg: "radial-gradient(ellipse 90% 55% at 95% 0%, #DDF3E6 0%, transparent 60%), linear-gradient(160deg, #F2FAF5 0%, #F8FBF9 45%, #EDF6F0 100%)",
           lines: "rgba(62,99,80,.05)", shape: "rgba(62,99,80,.08)", blob: "rgba(137,215,173,.45)", border: "#D5E7DC",
           text: "#1C3328", sub: "#5E7268", accent: "#3E8A62", gold: "#B8912F", pill: "rgba(255,255,255,.85)", pillB: "#D5E7DC",
           disc: "#3E8A62", discT: "#FFFFFF", logo: iconMint },
  dark:  { bg: "radial-gradient(ellipse 90% 55% at 95% 0%, #2f5240 0%, transparent 60%), linear-gradient(160deg, #284836 0%, #193326 42%, #12261c 72%, #0e1f17 100%)",
           lines: "rgba(255,255,255,.035)", shape: "rgba(120,170,140,.16)", blob: "rgba(96,150,118,.35)", border: "rgba(255,255,255,.14)",
           text: "#FFFFFF", sub: "#A9BCB1", accent: "#89D7AD", gold: "#D9B45A", pill: "rgba(255,255,255,.07)", pillB: "rgba(255,255,255,.22)",
           disc: "#89D7AD", discT: "#193326", logo: iconWhite },
};
const saved = () => { try { return localStorage.getItem("student.card") === "dark" ? "dark" : "light"; } catch { return "light"; } };

export default function StudentHeader({ name, grade, classNo, guardian = false }) {
  const nm = cleanName(name);
  const [mode, setMode] = useState(saved);
  const t = THEMES[mode];
  const flip = () => { const m = mode === "dark" ? "light" : "dark"; setMode(m); try { localStorage.setItem("student.card", m); } catch { /* لا شيء */ } };

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
      <div className="relative isolate min-w-0 overflow-hidden rounded-[18px] border-[1.5px] shadow-card sm:flex-1"
           style={{ background: t.bg, borderColor: t.border, color: t.text }}>
        {/* زخارف الهوية: خطوط مائلة، وهالة، ومكعبان */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0" style={{ background: `repeating-linear-gradient(135deg, ${t.lines} 0 1.5px, transparent 1.5px 22px)` }} />
          <div className="absolute h-56 w-56 rounded-full" style={{ background: t.blob, filter: "blur(60px)", left: 30, top: 10 }} />
          <div className="absolute h-44 w-44 rounded-[34px]" style={{ background: t.shape, transform: "rotate(32deg) skewX(-14deg)", left: -70, bottom: -80 }} />
          <div className="absolute h-44 w-44 rounded-[34px] opacity-70" style={{ background: t.shape, transform: "rotate(32deg) skewX(-14deg)", left: -40, bottom: -130 }} />
        </div>

        {/* شريط البوابة */}
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <span className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: t.sub }}>
            <img src={t.logo} alt="" className="h-5 w-5 object-contain" />
            بوابة مكة الثانوية الرقمية
          </span>
          <button onClick={flip} title={mode === "dark" ? "نسخة فاتحة" : "نسخة غامقة"} aria-label="تبديل الفاتح والغامق"
                  className="grid h-7 w-7 place-items-center rounded-full border text-xs" style={{ borderColor: t.pillB, color: t.sub, background: t.pill }}>
            {mode === "dark" ? "☀" : "☾"}
          </button>
        </div>
        <div className="mx-4 mt-2 h-[1.5px]" style={{ background: `linear-gradient(90deg, transparent, ${t.gold}, transparent)` }} />

        <div className="flex items-center gap-3.5 px-4 pb-4 pt-3">
          {/* قبعة التخرج رمزًا للطالب */}
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full shadow-card" style={{ background: t.disc, color: t.discT }} aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 9.5 12 5l10 4.5-10 4.5z" /><path d="M6 11.6V16c0 1.4 2.7 2.8 6 2.8s6-1.4 6-2.8v-4.4" /><path d="M22 9.5v5" />
            </svg>
          </span>
          <div className="min-w-0">
            {guardian && <p className="text-[11px] font-semibold" style={{ color: t.accent }}>ابنك</p>}
            <h1 className="text-lg font-bold leading-snug sm:text-xl">{nm || "—"}</h1>
            {(grade || classNo) && (
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                {grade && <span className="chip border" style={{ background: t.pill, borderColor: t.pillB, color: t.accent }}>{GRADE_NAMES[grade] ?? `الصف ${grade}`}</span>}
                {classNo && <span className="chip gap-1 border" style={{ background: t.pill, borderColor: t.pillB, color: t.sub }}>فصل <span className="num">{classNo}</span></span>}
              </p>
            )}
          </div>
        </div>
      </div>
      <HeaderChips />
    </header>
  );
}
