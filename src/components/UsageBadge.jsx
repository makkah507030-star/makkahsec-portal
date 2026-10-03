// src/components/UsageBadge.jsx
import { timesLabel, usageKey } from "../lib/usage.js";

/** شارة عدد الاستخدام على بطاقة النموذج — map تأتي من useUsageCounts فتكون null لغير الدعم الفني. */
export default function UsageBadge({ map, category, itemKey }) {
  if (!map) return null;
  const n = Number(map[usageKey(category, itemKey)]?.uses ?? 0);
  return (
    <span title="عدد مرات الاستخدام — يظهر للدعم الفني فقط"
          className={`chip shrink-0 border border-dashed ${n ? "border-mint-deep/40 bg-white text-mint-deep" : "border-line bg-white text-faint"}`}>
      {timesLabel(n)}
    </span>
  );
}
