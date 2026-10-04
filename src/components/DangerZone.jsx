// src/components/DangerZone.jsx
// منطقة حمراء حول الأزرار التي تغيّر بيانات البوابة المشتركة أو إحصائياتها،
// حتى يعرف المستخدم حجم الأثر قبل أن يجرّب. التأكيد نفسه في confirmDanger.
import { IS_STAGING } from "./StagingBadge.jsx";

export default function DangerZone({ children, note, className = "" }) {
  return (
    <div className={`rounded-card border-2 border-absent/35 bg-absent/[0.04] p-3 ${className}`}>
      <p className="mb-2 flex items-start gap-1.5 text-xs font-bold text-absent">
        <span aria-hidden="true">⚠</span>
        <span>{note ?? "إجراء يؤثر على بيانات البوابة لكل المستخدمين"}</span>
      </p>
      {children}
      {!IS_STAGING && (
        <p className="mt-2 text-[11px] text-faint">للتجربة استخدم النسخة التجريبية، لا البوابة الحقيقية.</p>
      )}
    </div>
  );
}
