import { EVIDENCE_LEAD, EVIDENCE_NOTE, LEVEL_LABEL } from "../lib/evidence.js";

/* مربع شواهد الأداء الوظيفي في صفحة إصدار النموذج */
export default function EvidenceBox({ items }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-sm2 border border-mint/40 bg-mint/10 px-3 py-2.5 text-sm">
      <p className="font-semibold text-mint-deep">{EVIDENCE_LEAD}:</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((it) => (
          <li key={it.element} className="flex items-start gap-2">
            <span className={`mt-0.5 shrink-0 rounded-full px-2 py-px text-[11px] font-semibold
              ${it.level === "direct" ? "bg-mint-deep text-white" : "border border-mint-deep/40 text-mint-deep"}`}>
              {LEVEL_LABEL[it.level]}
            </span>
            <span className="text-ink">{it.element}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs text-muted">{EVIDENCE_NOTE}</p>
    </div>
  );
}
