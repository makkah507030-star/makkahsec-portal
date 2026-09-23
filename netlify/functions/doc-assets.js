// netlify/functions/doc-assets.js
// =====================================================================
//  بوابة مكة الثانوية الرقمية
//  يعيد روابط موقّتة لصور التوقيع والختم الخاصة بمستند واحد،
//  بعد التحقق أن المستدعي يملك حق رؤيته: المستفيد، أو ولي أمره،
//  أو مُصدِر المستند، أو الدعم الفني ومدير المدرسة.
//
//  هذا المسار يغني عن فتح مخزن التواقيع لكل المستخدمين،
//  فالصور لا تُقرأ إلا عبر هذا التحقق.
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

    const { document_id } = JSON.parse(event.body || "{}");
    if (!document_id) return json({ error: "المستند غير محدّد" }, 400);

    const { data: doc } = await admin
      .from("form_documents")
      .select("id, status, created_by, recipient_user_id, student_id, signature_path, stamp_path")
      .eq("id", document_id)
      .maybeSingle();
    if (!doc) return json({ error: "المستند غير موجود" }, 404);

    // المستند غير المعتمد لا توقيع عليه ولا ختم
    if (!(doc.status === "issued" || doc.status === "approved")) {
      return json({ ok: true, signature: null, stamp: null, principal: null });
    }

    let allowed = doc.created_by === uid || doc.recipient_user_id === uid;

    if (!allowed) {
      const { data: roles } = await admin
        .from("admin_roles").select("role_type").eq("user_id", uid);
      allowed = (roles || []).some(
        (r) => r.role_type === "tech_support" || r.role_type === "principal",
      );
    }

    if (!allowed && doc.student_id) {
      const { data: g } = await admin
        .from("guardians").select("id").eq("user_id", uid).maybeSingle();
      if (g) {
        const { data: link } = await admin
          .from("guardian_student")
          .select("student_id")
          .eq("guardian_id", g.id)
          .eq("student_id", doc.student_id)
          .maybeSingle();
        allowed = Boolean(link);
      }
    }

    if (!allowed) return json({ error: "لا تملك صلاحية عرض هذا المستند" }, 403);

    const sign = async (path) => {
      if (!path) return null;
      const { data } = await admin.storage.from("form-assets").createSignedUrl(path, 600);
      return data?.signedUrl ?? null;
    };

    const { data: assets } = await admin
      .from("school_assets").select("key, path, label");
    const principalPath = (assets || []).find((a) => a.key === "principal_signature")?.path;
    const principalName = (assets || []).find((a) => a.key === "principal_signature")?.label ?? "";

    return json({
      ok: true,
      signature: await sign(doc.signature_path),
      stamp: await sign(doc.stamp_path),
      principal: await sign(principalPath),
      principal_name: principalName,
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
};
