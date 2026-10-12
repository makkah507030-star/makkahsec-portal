// src/lib/edgeError.js
// يستخرج رسالة الخطأ الفعلية من استجابة Supabase Edge Function
// (بدل الرسالة العامة "Edge Function returned a non-2xx status code")
export async function describeEdgeError(e) {
  if (e?.context && typeof e.context.clone === "function") {
    try {
      const body = await e.context.clone().json();
      if (body?.error || body?.message) return body.error ?? body.message;
    } catch {
      try {
        const text = await e.context.clone().text();
        if (text) return text;
      } catch { /* تجاهل */ }
    }
  }
  return e?.message ?? String(e);
}
