// netlify/functions/deputy-signature.js
// =====================================================================
//  بوابة مكة الثانوية الرقمية
//  توقيع وكيل شؤون الطلاب على جداول الاختبارات المطبوعة من صفحة الطالب
//  وولي الأمر والمعلم. التوقيع محفوظ في «توقيعي» ولا يقرؤه من التخزين إلا
//  صاحبه والمدير والدعم الفني؛ فتعيده هذه الدالة رابطًا موقّتًا لأي مستخدم
//  مسجّل الدخول — كما يظهر توقيع المدير وختم المدرسة على الوثائق المطبوعة.
// =====================================================================

import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body, status = 200) => ({
  statusCode: status,
  headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const token = (event.headers.authorization || event.headers.Authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "غير مصرّح" }, 401);
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user?.id) return json({ error: "جلسة غير صالحة" }, 401);

    const { data: role } = await admin.from("admin_roles")
      .select("user_id, users(full_name)").eq("role_type", "deputy_students").limit(1).maybeSingle();
    if (!role?.user_id) return json({ ok: true, name: "", signature: null });

    const { data: sig } = await admin.from("user_signatures")
      .select("path").eq("user_id", role.user_id).maybeSingle();
    let signature = null;
    if (sig?.path) {
      const { data } = await admin.storage.from("form-assets").createSignedUrl(sig.path, 3600);
      signature = data?.signedUrl ?? null;
    }
    return json({ ok: true, name: role.users?.full_name ?? "", signature });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
};
