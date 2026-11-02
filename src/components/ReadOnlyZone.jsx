// src/components/ReadOnlyZone.jsx
import { useSession } from "../lib/session.jsx";

/* =====================================================================
   وضع «عرض فقط» لأقسام البرامج (جلوب والموهوبين والكشافة) لحساب الدعم الفني:
   يرى القسم كاملًا بتبويباته وتقاريره وطباعته، ولا يعدّل شيئًا. كل زر أو حقل
   داخل المنطقة معطّل إلا ما وُسم data-ro-ok (التنقل والتصفية والبحث والعرض والطباعة).
   programRole(r): دور البرنامج نفسه، فإن حمله الحساب مع الدعم الفني عدّل كالمعتاد.
   ===================================================================== */

export function useSupportReadOnly(programRole) {
  const { adminRoles } = useSession();
  return adminRoles.includes("tech_support") && !adminRoles.includes("principal")
    && !adminRoles.some((r) => (typeof programRole === "function" ? programRole(r) : r === programRole));
}

const CONTROL = "button, select, input, textarea, [role=button], label";
const blocked = (t) => {
  const el = t?.closest?.(CONTROL);
  return !!el && !el.closest("[data-ro-ok]");
};
const stop = (e) => { if (blocked(e.target)) { e.preventDefault(); e.stopPropagation(); } };
const stopKey = (e) => { if ((e.key === "Enter" || e.key === " ") && blocked(e.target)) { e.preventDefault(); e.stopPropagation(); } };

export default function ReadOnlyZone({ on, children }) {
  if (!on) return children;
  return (
    <div className="ro-zone space-y-4" onClickCapture={stop} onChangeCapture={stop} onInputCapture={stop} onKeyDownCapture={stopKey}>
      <p className="flex items-center gap-2 rounded-sm2 border border-warning/30 bg-warning-light px-3 py-2 text-xs font-semibold text-warning">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
        عرض فقط: يطّلع حساب الدعم الفني على القسم دون تعديل.
      </p>
      {children}
    </div>
  );
}
