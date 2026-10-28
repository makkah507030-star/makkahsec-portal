// src/components/StudentHeader.jsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { rankOf } from "../lib/scoutLeader.js";
import { domainOf } from "../lib/gifted.js";
import HeaderChips from "./HeaderChips.jsx";
import { GRADE_NAMES } from "../lib/schoolTime";
import { useStudioTheme, StudioDecor } from "../lib/studioTheme.jsx";

/* =====================================================================
   بطاقة الاسم أعلى الرئيسية، بهوية استوديو البوابة الرسمية (studio/studio.css:
   .stu-light و.stu-dark): خلفية بخطوط مائلة وهالة ومكعبين، وشريط البوابة، ورمز
   صاحبها (طالب أو معلم أو إداري) أو صورته، والاسم وشاراته. فاتحة أو غامقة، ويُتذكّر الاختيار.
   NameCard للجميع؛ StudentHeader للطالب وولي أمره، وStaffHeader للمعلم والإداري.
   ===================================================================== */

// الاسم كما في نور قد يحمل شرطة أو مسافات زائدة في طرفيه
export const cleanName = (n) => String(n ?? "").replace(/^[\s\-–—_.]+|[\s\-–—_.]+$/g, "").replace(/\s+/g, " ");

// رموز أصحاب البطاقة: قبعة التخرج للطالب، والسبورة للمعلم، والحقيبة للإداري
const ICONS = {
  student: <><path d="M2 9.5 12 5l10 4.5-10 4.5z" /><path d="M6 11.6V16c0 1.4 2.7 2.8 6 2.8s6-1.4 6-2.8v-4.4" /><path d="M22 9.5v5" /></>,
  teacher: <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M7 9h6M7 12h4M12 16v4M8 20h8" /><path d="m16 8 2 2-2 2" /></>,
  admin:   <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18M10.5 12.5v2h3v-2" /></>,
};

/* chips: [{ t, strong }]؛ avatar: رابط الصورة؛ onPick: يتيح رفع صورة بالضغط على الرمز */
export function NameCard({ name, kicker, chips = [], icon = "student", avatar = null, onPick = null, busy = false, aside = <HeaderChips /> }) {
  const [mode, t, flip] = useStudioTheme();
  const input = useRef(null);
  const disc = (
    <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full shadow-card"
          style={{ background: t.disc, color: t.discT }}>
      {avatar
        ? <img src={avatar} alt="" className="h-full w-full object-cover" />
        : <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[icon]}</svg>}
      {onPick && (
        <span className="absolute inset-x-0 bottom-0 bg-black/45 py-0.5 text-center text-[9px] font-semibold text-white">
          {busy ? "…" : avatar ? "تغيير" : "صورتك"}
        </span>
      )}
    </span>
  );

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
      <div className="relative isolate min-w-0 overflow-hidden rounded-[18px] border-[1.5px] shadow-card sm:flex-1"
           style={{ background: t.bg, borderColor: t.border, color: t.text }}>
        <StudioDecor t={t} />

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
          {onPick ? (
            <button type="button" disabled={busy} onClick={() => input.current?.click()}
                    title={avatar ? "تغيير الصورة" : "رفع صورتك"} aria-label={avatar ? "تغيير الصورة" : "رفع صورتك"}>
              {disc}
              <input ref={input} type="file" accept="image/*" className="hidden"
                     onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }} />
            </button>
          ) : disc}
          <div className="min-w-0">
            {kicker && <p className="text-[11px] font-semibold" style={{ color: t.accent }}>{kicker}</p>}
            <h1 className="text-lg font-bold leading-snug sm:text-xl">{cleanName(name) || "—"}</h1>
            {chips.length > 0 && (
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                {chips.map((c, i) => c.badge ? (
                  <span key={i} className="chip gap-1 border font-semibold" title={c.title}
                        style={{ background: `${c.color}1F`, borderColor: c.color, color: c.color }}>{c.t}</span>
                ) : c.scout ? (
                  <span key={i} className="chip gap-1 border font-semibold" title="الفريق الكشفي"
                        style={{ background: `${c.color}1F`, borderColor: c.color, color: c.color }}>{c.t}</span>
                ) : (
                  <span key={i} className="chip gap-1 border" style={{ background: t.pill, borderColor: t.pillB, color: c.strong ? t.accent : t.sub }}>{c.t}</span>
                ))}
              </p>
            )}
          </div>
        </div>
      </div>
      {aside}
    </header>
  );
}

export default function StudentHeader({ name, grade, classNo, studentId = null, guardian = false }) {
  // شارة الفريق الكشفي ورتبته (supabase/scouts_3.sql) — وسم خاص في البطاقة لعضو الفريق
  const [scout, setScout] = useState(null);
  useEffect(() => {
    setScout(null);
    if (!studentId) return;
    supabase.rpc("scout_badge", { p_student: studentId }).then(({ data }) => setScout(data ?? null));
  }, [studentId]);
  // وسم «موهوب» (supabase/gifted_2.sql) لمن في الطلاب الموهوبين، بمجال موهبته الأول إن حُدّد
  const [gifted, setGifted] = useState(null);
  useEffect(() => {
    setGifted(null);
    if (!studentId) return;
    supabase.rpc("gifted_badge", { p_student: studentId }).then(({ data }) => setGifted(data ?? null), () => {});
  }, [studentId]);
  const rank = rankOf(scout?.rank);
  const gDomain = gifted?.domains?.[0] ? domainOf(gifted.domains[0]) : null;
  return (
    <NameCard name={name} icon="student" kicker={guardian ? "ابنك" : null}
              chips={[grade && { t: GRADE_NAMES[grade] ?? `الصف ${grade}`, strong: true },
                      classNo && { t: <>فصل <span className="num">{classNo}</span></> },
                      scout && { scout: true, color: rank?.color ?? "#3E8A62",
                                 t: <><span aria-hidden="true">⚜</span> {rank ? rank.t : "عضو الفريق الكشفي"}</> },
                      gifted && { badge: true, color: "#7A4FB5", title: gifted.source === "mawhiba" ? "اكتُشف في مقياس موهبة" : "برنامج الموهوبين",
                                  t: <><span aria-hidden="true">★</span> موهوب{gDomain ? ` · ${gDomain.t}` : ""}</> },
              ].filter(Boolean)} />
  );
}
