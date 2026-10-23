// netlify/lib/cronHost.js
// =====================================================================
//  المنصة التي تشغّل الدوال المجدولة: Netlify أو Vercel، لا الاثنتان.
//  الدوال نفسها تعمل على المنصتين أثناء الانتقال، فلو شغّلتها كلتاهما
//  لوصل المعلمين التذكير مرتين. الاختيار في جدول settings بالمفتاح
//  cron_host ('netlify' افتراضيًا أو 'vercel')، فيُبدَّل بسطر SQL
//  واحد عند التحويل أو الرجوع، دون نشر جديد.
// =====================================================================

import { createClient } from "@supabase/supabase-js";

export const platform = () => (process.env.VERCEL ? "vercel" : "netlify");

export async function cronAllowed() {
  try {
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data } = await db.from("settings").select("value").eq("key", "cron_host").maybeSingle();
    return (data?.value || "netlify") === platform();
  } catch (e) {
    // إن تعذّرت القراءة يبقى Netlify هو المشغّل كما كان قبل الانتقال
    console.error("[cronHost]", e?.message || e);
    return platform() === "netlify";
  }
}

export const skipped = () => ({ statusCode: 200, body: `cron host is not ${platform()}` });
