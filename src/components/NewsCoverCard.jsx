import { ROLE_COVER_HUE, ADMIN_ROLE_LABEL, ROLE_PERSON_NAME, coverGradient } from "../lib/session.jsx";

// بطاقة غلاف مولّدة تلقائيًا لحساب إداري: تدرّج لوني ثابت خاص بالحساب
// + اسم الحساب (واسم شاغله إن وُجد) — تُستخدم بديلًا عن رفع صورة غلاف يدويًا.
// compact: عرض أفقي مضغوط (شريط) بدل التكديس العمودي — لعرضه كشريط رفيع أعلى صفحة الخبر.
export default function NewsCoverCard({ role, className = "", compact = false }) {
  const hue = ROLE_COVER_HUE[role] ?? 152;
  const label = ADMIN_ROLE_LABEL[role] ?? "بوابة مكة الثانوية";
  const person = ROLE_PERSON_NAME[role];

  return (
    <div
      className={`relative flex overflow-hidden ${
        compact
          ? "flex-row-reverse items-center justify-center gap-2"
          : "flex-col items-center justify-center gap-1"
      } ${className}`}
      style={{ background: coverGradient(hue) }}
    >
      <div className="absolute -top-7 -left-7 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-9 -right-5 h-28 w-28 rounded-full bg-white/10" />
      <span className="relative px-2 text-center text-sm font-bold leading-snug text-white drop-shadow-sm">
        {label}
      </span>
      {person && (
        <span
          className={`relative px-2 text-center font-medium leading-snug text-white/85 ${
            compact ? "text-xs" : "text-[11px]"
          }`}
        >
          {compact ? `— ${person}` : person}
        </span>
      )}
    </div>
  );
}
