import { useState } from "react";

/**
 * مفتاح الألوان — يشرح دلالة الألوان والشارات في الشاشة.
 *
 * يقبل شكلين:
 *   items  = [{ color|chip, label, sample?, note? }]                   ← قائمة مسطّحة
 *   groups = [{ title, items: [...] }]                                 ← مجموعات معنونة
 */
export default function ColorLegend({
  items,
  groups,
  title = "دلالة الألوان والرموز",
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);

  const sections = groups?.length
    ? groups
    : items?.length
    ? [{ title: null, items }]
    : [];

  if (!sections.length) return null;

  const total = sections.reduce((n, g) => n + g.items.length, 0);

  return (
    <section className="overflow-hidden rounded-card border border-line bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-right transition-colors hover:bg-canvas"
      >
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-[#6AA786]"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span className="text-xs font-semibold text-muted">{title}</span>
          <span className="num text-[11px] text-faint">({total})</span>
        </span>

        <svg viewBox="0 0 24 24" fill="none"
             className={`h-4 w-4 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="space-y-4 border-t border-line px-4 py-4">
          {sections.map((g, gi) => (
            <div key={gi}>
              {g.title && (
                <p className="mb-2 text-[11px] font-semibold text-[#6AA786]">{g.title}</p>
              )}
              <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {g.items.map((it, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex w-[5.5rem] shrink-0 justify-start">
                      {it.chip ? (
                        <span className={`chip whitespace-nowrap ${it.chip}`}>
                          {it.sample ?? it.label}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <span className={`h-3 w-3 rounded-full ${it.color}`} />
                          <span className="text-xs font-medium text-ink">{it.label}</span>
                        </span>
                      )}
                    </span>

                    <span className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
                      {it.chip ? it.label : it.note}
                      {it.chip && it.note && (
                        <span className="text-faint"> — {it.note}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---- مجموعات جاهزة ---- */

export const ATTENDANCE_LEGEND = [
  { color: "bg-present", label: "حاضر",   note: "موجود في الحصة" },
  { color: "bg-absent",  label: "غائب",   note: "غير موجود بلا استئذان" },
  { color: "bg-late",    label: "متأخر",  note: "حضر بعد بداية الحصة" },
  { color: "bg-excused", label: "مستأذن", note: "خرج بإذن معتمد" },
];
