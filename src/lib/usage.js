// src/lib/usage.js
// عدّاد استخدام النماذج والاستوديو (supabase/usage_stats.sql). الأرقام للدعم الفني وحده.
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useSession } from "./session.jsx";

/** يسجّل طباعة/تنزيل/حفظ لما لا يُحفظ في قاعدة البيانات أصلًا (الاستوديو والشهادة). لا يعطّل شيئًا لو فشل. */
export function trackUsage(category, itemKey, action) {
  supabase.from("usage_events").insert({ category, item_key: itemKey, action }).then(() => {}, () => {});
}

export const usageKey = (category, itemKey) => `${category}:${itemKey}`;

/** صفوف التقرير — p_from/p_to اختياريان. يرمي الخطأ لمن يعرضه. */
export async function fetchUsage({ from = null, to = null } = {}) {
  const { data, error } = await supabase.rpc("usage_report", { p_from: from, p_to: to });
  if (error) throw error;
  return data ?? [];
}

let cached = null;

/** خريطة «الفئة:المفتاح» ← صف العدّاد، للدعم الفني فقط؛ لغيره دائمًا null فلا يظهر شيء. */
export function useUsageCounts() {
  const { adminRoles } = useSession();
  const tech = adminRoles.includes("tech_support");
  const [map, setMap] = useState(null);
  useEffect(() => {
    if (!tech) return undefined;
    let alive = true;
    cached ??= fetchUsage()
      .then((rows) => Object.fromEntries(rows.map((r) => [usageKey(r.category, r.item_key), r])))
      .catch(() => { cached = null; return null; });
    cached.then((m) => { if (alive) setMap(m); });
    return () => { alive = false; };
  }, [tech]);
  return tech ? map : null;
}
