import { ROLE_COVER_HUE, ADMIN_ROLE_LABEL, ROLE_PERSON_NAME, coverGradient } from "../lib/session.jsx";

// بطاقة غلاف مولّدة تلقائيًا لحساب إداري: تدرّج لوني ثابت خاص بالحساب —
// تُستخدم بديلًا عن رفع صورة غلاف يدويًا. تعرض اسم الحساب فقط.
// compact: نسخة الشريط الرفيع أعلى صفحة الخبر — تضيف اسم شاغل الحساب
// (إن وُجد) تحت اسم الحساب بفاصل رفيع، بتصميم أكثر احترافية.
export default function NewsCoverCard({ role, className = "", compact = false }) {
  const hue = ROLE_COVER_HUE[role] ?? 152;
  const label = ADMIN_ROLE_LABEL[role] ?? "بوابة مكة الثانوية";
  const person = compact ? ROLE_PERSON_NAME[role] : null;

  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-1.5 overflow-hidden ${className}`}
      style={{ background: coverGradient(hue) }}
    >
      <div className="absolute -top-7 -left-7 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-9 -right-5 h-28 w-28 rounded-full bg-white/10" />
      <span
        className={`relative px-3 text-center font-bold leading-snug text-white drop-shadow-sm ${
          compact ? "text-[15px] tracking-wide" : "text-sm"
        }`}
      >
        {label}
      </span>
      {person && (
        <>
          <span className="relative h-px w-9 bg-white/35" />
          <span className="relative px-3 text-center text-[12px] font-medium leading-snug text-white/80">
            {person}
          </span>
        </>
      )}
    </div>
  );
}
