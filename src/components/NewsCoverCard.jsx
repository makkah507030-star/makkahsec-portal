import { ROLE_COVER_HUE, ADMIN_ROLE_LABEL, ROLE_PERSON_NAME, coverGradient } from "../lib/session.jsx";

// أيقونة مناسبة لكل حساب إداري — بنفس أسلوب أيقونات القائمة الجانبية
const ICON_PATHS = {
  principal:        "M4 18h16l-1.2-9L14 13l-2-7-2 7-4.8-4L4 18Z",
  deputy_academic:  "M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  deputy_school:    "M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  deputy_students:  "M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  counselor_1:      "M21 12a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 0 1 8-8h2a8 8 0 0 1 8 4Z",
  counselor_2:      "M21 12a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 0 1 8-8h2a8 8 0 0 1 8 4Z",
  counselor_3:      "M21 12a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 0 1 8-8h2a8 8 0 0 1 8 4Z",
  clerk:            "M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5zM4 19.5A2.5 2.5 0 0 1 6.5 17H20v5H6.5A2.5 2.5 0 0 1 4 19.5z",
  activity_leader:  "M4 21V3M4 4h11l-2 4 2 4H4",
  tech_support:     "M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-2.6 2.6-2-2Z",
  media_portal:     "M3 11v2a2 2 0 0 0 2 2h1l2 6h2l-1.5-6H10l9 4V5l-9 4H5a2 2 0 0 0-2 2Zm7-2v6",
  gifted_program:   "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM8.2 13.5 6 21l6-3 6 3-2.2-7.5",
  globe_program:    "M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10ZM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z",
  student_voice:    "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  makkah_sport:     "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 4H4v2a3 3 0 0 0 3 3M17 4h3v2a3 3 0 0 1-3 3",
  safety_security:  "M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6z",
  health_counselor: "M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 5.5 5.5 5.5 0 0 1 21.5 12c-2.5 4.5-9.5 9-9.5 9Z",
  science_labs:     "M9 2v6L4 20a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L15 8V2M9 2h6M8 15h8",
  computer_lab:     "M4 4h16v10H4zM8 20h8M12 14v6",
};

function RoleIcon({ role, className }) {
  const d = ICON_PATHS[role] ?? ICON_PATHS.tech_support;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// بطاقة غلاف مولّدة تلقائيًا لحساب إداري: تدرّج لوني ثابت خاص بالحساب —
// تُستخدم بديلًا عن رفع صورة غلاف يدويًا. تعرض اسم الحساب فقط.
// compact: نسخة الشريط الرفيع أعلى صفحة الخبر — اسم الحساب واسم شاغله
// (إن وُجد) في الجانب الأيمن، وأيقونة الحساب في دائرة بالجانب الأيسر.
export default function NewsCoverCard({ role, className = "", compact = false }) {
  const hue = ROLE_COVER_HUE[role] ?? 152;
  const label = ADMIN_ROLE_LABEL[role] ?? "بوابة مكة الثانوية";
  const person = compact ? ROLE_PERSON_NAME[role] : null;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${
        compact ? "gap-3 px-4" : "px-3"
      } ${className}`}
      style={{ background: coverGradient(hue) }}
    >
      <div className="absolute -top-6 -left-6 h-20 w-20 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -right-4 h-24 w-24 rounded-full bg-white/10" />

      <div className={`relative flex flex-col ${compact ? "items-end text-right" : "items-center text-center"}`}>
        <span className={`font-bold leading-tight text-white drop-shadow-sm ${compact ? "text-[15px]" : "text-sm"}`}>
          {label}
        </span>
        {person && (
          <span className="mt-0.5 text-[12px] font-medium leading-tight text-white/80">
            {person}
          </span>
        )}
      </div>

      {compact && (
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/20 ring-1 ring-white/25">
          <RoleIcon role={role} className="h-[22px] w-[22px] text-white" />
        </span>
      )}
    </div>
  );
}
