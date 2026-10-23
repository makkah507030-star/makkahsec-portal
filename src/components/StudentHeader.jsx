// src/components/StudentHeader.jsx
import HeaderChips from "./HeaderChips.jsx";
import { GRADE_NAMES } from "../lib/schoolTime";

/* =====================================================================
   بطاقة الطالب أعلى الرئيسية للطالب وولي أمره: رمز الطالب في دائرة، والاسم،
   والصف والفصل في شارتين، وبطاقات الأسبوع والتاريخ (HeaderChips) بجانبها.
   ===================================================================== */

// الاسم كما في نور قد يحمل شرطة أو مسافات زائدة في طرفيه
export const cleanName = (n) => String(n ?? "").replace(/^[\s\-–—_.]+|[\s\-–—_.]+$/g, "").replace(/\s+/g, " ");

export default function StudentHeader({ name, grade, classNo, guardian = false }) {
  const nm = cleanName(name);
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
      <div className="flex min-w-0 items-center gap-3.5 sm:flex-1 rounded-card border border-mint-light bg-gradient-to-l from-mint-tint to-paper px-4 py-3.5 shadow-card">
        {/* قبعة التخرج رمزًا للطالب */}
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-mint-deep text-white shadow-card" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 9.5 12 5l10 4.5-10 4.5z" /><path d="M6 11.6V16c0 1.4 2.7 2.8 6 2.8s6-1.4 6-2.8v-4.4" /><path d="M22 9.5v5" />
          </svg>
        </span>
        <div className="min-w-0">
          {guardian && <p className="text-[11px] font-semibold text-mint-deep">ابنك</p>}
          <h1 className="text-lg font-bold leading-snug text-ink sm:text-xl">{nm || "—"}</h1>
          {(grade || classNo) && (
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              {grade && <span className="chip bg-white text-mint-deep shadow-sm">{GRADE_NAMES[grade] ?? `الصف ${grade}`}</span>}
              {classNo && <span className="chip gap-1 bg-white text-muted shadow-sm">فصل <span className="num">{classNo}</span></span>}
            </p>
          )}
        </div>
      </div>
      <HeaderChips />
    </header>
  );
}
