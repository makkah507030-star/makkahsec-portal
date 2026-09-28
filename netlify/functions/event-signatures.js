// netlify/functions/event-signatures.js
// =====================================================================
//  بوابة مكة الثانوية الرقمية
//  روابط موقّتة لتواقيع منظّم الحدث والمعلمين المشاركين في تنظيمه،
//  لشهادات الحدث وتقريره. مخزن التواقيع مغلق (كلٌّ يقرأ توقيعه فقط)،
//  فتُقرأ هنا بعد التحقق أن المستدعي المنظّم أو أحد المشاركين في التنظيم،
//  أو مدير المدرسة أو الدعم الفني.
// =====================================================================

const { createClient } = require("@supabase/supabase-js");

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

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const auth = event.headers.authorization || event.headers.Authorization || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "غير مصرّح" }, 401);

    const { data: u } = await admin.auth.getUser(token);
    const uid = u?.user?.id;
    if (!uid) return json({ error: "جلسة غير صالحة" }, 401);

    const { event_id } = JSON.parse(event.body || "{}");
    if (!event_id) return json({ error: "الحدث غير محدّد" }, 400);

    const { data: ev } = await admin
      .from("school_events").select("id, organizer_id, co_organizers")
      .eq("id", event_id).maybeSingle();
    if (!ev) return json({ error: "الحدث غير موجود" }, 404);

    const coIds = (Array.isArray(ev.co_organizers) ? ev.co_organizers : [])
      .map((c) => c?.user_id).filter(Boolean);

    let allowed = ev.organizer_id === uid || coIds.includes(uid);
    if (!allowed) {
      const { data: roles } = await admin
        .from("admin_roles").select("role_type").eq("user_id", uid);
      allowed = (roles || []).some(
        (r) => r.role_type === "tech_support" || r.role_type === "principal",
      );
    }
    if (!allowed) return json({ error: "لا تملك صلاحية عرض تواقيع هذا الحدث" }, 403);

    const ids = [ev.organizer_id, ...coIds].filter(Boolean);
    const { data: sigs } = await admin
      .from("user_signatures").select("user_id, path").in("user_id", ids);

    const urls = {};
    for (const s of sigs || []) {
      if (!s.path) continue;
      const { data } = await admin.storage.from("form-assets").createSignedUrl(s.path, 3600);
      urls[s.user_id] = data?.signedUrl ?? null;
    }

    return json({ ok: true, organizer: urls[ev.organizer_id] ?? null, co: urls });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
};
