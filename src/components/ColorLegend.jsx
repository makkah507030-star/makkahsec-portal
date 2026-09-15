/**
 * مفتاح الألوان — شريط صغير يشرح دلالة الألوان والشارات في الشاشة.
 *
 * الاستخدام:
 *   <ColorLegend items={[
 *     { color: "bg-present", label: "حاضر" },
 *     { chip: "bg-warning-light text-warning", label: "لم يبصم" },
 *   ]} />
 */
export default function ColorLegend({ items, title = "دلالة الألوان" }) {
  if (!items?.length) return null;

  return (
    <section className="rounded-card border border-line bg-white px-4 py-3">
      <p className="text-[11px] font-semibold text-faint">{title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        {items.map((it, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs text-muted">
            {it.chip ? (
              <span className={`chip ${it.chip}`}>{it.sample ?? it.label}</span>
            ) : (
              <span className={`h-3 w-3 shrink-0 rounded-full ${it.color}`} />
            )}
            {!it.chip && <span>{it.label}</span>}
            {it.chip && it.sample && <span>{it.label}</span>}
            {it.note && <span className="text-faint">— {it.note}</span>}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ---- مجموعات جاهزة تُستخدم في أكثر من شاشة ---- */

export const ATTENDANCE_LEGEND = [
  { color: "bg-present", label: "حاضر" },
  { color: "bg-absent",  label: "غائب" },
  { color: "bg-late",    label: "متأخر" },
  { color: "bg-excused", label: "مستأذن" },
];
