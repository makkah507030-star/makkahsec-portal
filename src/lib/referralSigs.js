// src/lib/referralSigs.js
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/* =====================================================================
   تواقيع ملف الإحالة: الملف يحفظ مسار صورة التوقيع في التخزين (form-assets)
   لا رابطها، ومخزن التواقيع لا يقرؤه إلا صاحبه. فتُطلب روابط موقّتة من
   الدالة referral-assets بعد تحققها أن المستدعي يملك رؤية الإحالة.
   تُخزَّن الروابط مؤقتًا (9 دقائق) فلا تتكرر الطلبات بين العرض والطباعة.
   ===================================================================== */

const FIELDS = ["teacher_sig", "deputy_sig", "counselor_sig"];
const isUrl = (v) => /^(https?:|data:|blob:)/.test(String(v ?? ""));
const cache = new Map();   // key -> { at, urls }

async function fetchSigs(id) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/.netlify/functions/referral-assets", {
    method: "POST",
    headers: { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify({ referral_id: id }),
  });
  const j = await res.json().catch(() => ({}));
  return res.ok ? j : {};
}

// يعيد نسخة من الإحالة حقول تواقيعها روابط صالحة للعرض (أو null حتى تصل)
export function useReferralSigs(r) {
  const paths = r ? FIELDS.map((f) => r[f] ?? "").join("|") : "";
  const key = r ? `${r.id}|${paths}` : "";
  const [urls, setUrls] = useState(() => cache.get(key)?.urls ?? null);

  useEffect(() => {
    if (!r?.id || !FIELDS.some((f) => r[f] && !isUrl(r[f]))) { setUrls(null); return; }
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 9 * 60000) { setUrls(hit.urls); return; }
    let alive = true;
    fetchSigs(r.id).then((u) => {
      cache.set(key, { at: Date.now(), urls: u });
      if (alive) setUrls(u);
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!r) return r;
  const out = { ...r };
  FIELDS.forEach((f) => {
    if (r[f] && !isUrl(r[f])) out[f] = urls?.[f] ?? null;   // مسار تخزين ← رابط موقّت
  });
  return out;
}
