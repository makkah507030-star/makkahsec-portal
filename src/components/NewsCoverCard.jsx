import { ROLE_COVER_HUE, ADMIN_ROLE_LABEL, coverGradient } from "../lib/session.jsx";

// بطاقة غلاف مولّدة تلقائيًا لحساب إداري: تدرّج لوني ثابت خاص بالحساب
// + اسم الحساب — تُستخدم بديلًا عن رفع صورة غلاف يدويًا.
export default function NewsCoverCard({ role, className = "" }) {
  const hue = ROLE_COVER_HUE[role] ?? 152;
  const label = ADMIN_ROLE_LABEL[role] ?? "بوابة مكة الثانوية";

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: coverGradient(hue) }}
    >
      <div className="absolute -top-7 -left-7 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-9 -right-5 h-28 w-28 rounded-full bg-white/10" />
      <span className="relative px-3 text-center text-sm font-bold leading-snug text-white drop-shadow-sm">
        {label}
      </span>
    </div>
  );
}
