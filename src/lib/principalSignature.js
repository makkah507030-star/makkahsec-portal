// src/lib/principalSignature.js
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/* =====================================================================
   توقيع مدير المدرسة المعتمد — يُرفع مرة واحدة من «إدارة النماذج»
   (school_assets.principal_signature في مخزن form-assets)، ويظهر في كل
   التقارير المطبوعة فوق اسم المدير.
   يُجلب مرة واحدة في الجلسة ويُعاد استخدامه؛ الرابط الموقّع صالح ساعة
   فيُجدَّد بعد ٥٠ دقيقة.
   ===================================================================== */

const TTL = 50 * 60 * 1000;
let cache = null;   // { at, promise }

/** { url, name } — url = null إن لم يُرفع توقيع أو تعذّر جلبه */
export function loadPrincipalSignature() {
  if (cache && Date.now() - cache.at < TTL) return cache.promise;
  const promise = (async () => {
    try {
      const { data } = await supabase.from("school_assets")
        .select("path, label").eq("key", "principal_signature").maybeSingle();
      if (!data?.path) return { url: null, name: data?.label ?? "" };
      const { data: s } = await supabase.storage.from("form-assets").createSignedUrl(data.path, 3600);
      const url = s?.signedUrl ?? null;
      // تحميل الصورة مسبقًا: صفحات تطبع بعد لحظات من عرض الورقة فلا تنتظر التحميل
      if (url && typeof Image !== "undefined") new Image().src = url;
      return { url, name: data.label ?? "" };
    } catch {
      return { url: null, name: "" };
    }
  })();
  cache = { at: Date.now(), promise };
  return promise;
}

export function usePrincipalSignature() {
  const [sig, setSig] = useState({ url: null, name: "" });
  useEffect(() => {
    let alive = true;
    loadPrincipalSignature().then((s) => { if (alive) setSig(s); });
    return () => { alive = false; };
  }, []);
  return sig;
}
