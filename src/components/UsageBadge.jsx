// src/components/UsageBadge.jsx
import { usageKey } from "../lib/usage.js";

/** عدد مرات استخدام النموذج على بطاقته — map تأتي من useUsageCounts فتكون null لغير الدعم الفني. */
export default function UsageBadge({ map, category, itemKey }) {
  if (!map) return null;
  const n = Number(map[usageKey(category, itemKey)]?.uses ?? 0);
  return (
    <span title={`استُخدم ${n} مرة — يظهر للدعم الفني فقط`}
          className={`chip num shrink-0 border border-dashed ${n ? "border-mint-deep/40 bg-white text-mint-deep" : "border-line bg-white text-faint"}`}>
      {n}
    </span>
  );
}
