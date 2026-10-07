// netlify/functions/referral-assets.js
// =====================================================================
//  بوابة مكة الثانوية الرقمية
//  يعيد روابط موقّتة لتواقيع ملف إحالة واحد (المعلم، والوكيل، والموجه)،
//  بعد التحقق أن المستدعي يملك رؤيته — بالقاعدة نفسها في قاعدة البيانات
//  (referrals_scope.sql): المعلم المُحيل، والموجه المحال إليه، والوكيل الذي
//  عالجها، ووكيل شؤون الطلاب والمدير والدعم الفني، والطالب وولي أمره.
//
//  مخزن التواقيع لا يقرؤه إلا صاحب التوقيع، فهذا المسار يغني عن فتحه.
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

const MANAGERS = ["principal", "tech_support", "deputy_students"];

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
    const uid = u?.user?.id;
    if (!uid) return json({ error: "جلسة غير صالحة" }, 401);

    const { referral_id } = JSON.parse(event.body || "{}");
    if (!referral_id) return json({ error: "الإحالة غير محدّدة" }, 400);

    const { data: r } = await admin.from("student_referrals")
      .select("id, student_id, teacher_id, deputy_id, counselor_id, teacher_sig, deputy_sig, counselor_sig")
      .eq("id", referral_id).maybeSingle();
    if (!r) return json({ error: "الإحالة غير موجودة" }, 404);

    let allowed = [r.teacher_id, r.deputy_id, r.counselor_id].includes(uid);

    if (!allowed) {
      const { data: roles } = await admin.from("admin_roles").select("role_type").eq("user_id", uid);
      allowed = (roles || []).some((x) => MANAGERS.includes(x.role_type));
    }
    if (!allowed) {
      const { data: s } = await admin.from("students").select("id").eq("user_id", uid).eq("id", r.student_id).maybeSingle();
      allowed = Boolean(s);
    }
    if (!allowed) {
      const { data: g } = await admin.from("guardians").select("id").eq("user_id", uid).maybeSingle();
      if (g) {
        const { data: link } = await admin.from("guardian_student").select("student_id")
          .eq("guardian_id", g.id).eq("student_id", r.student_id).maybeSingle();
        allowed = Boolean(link);
      }
    }
    if (!allowed) return json({ error: "لا تملك صلاحية عرض هذه الإحالة" }, 403);

    // القيم القديمة قد تكون روابط جاهزة — تُعاد كما هي
    const sign = async (v) => {
      if (!v) return null;
      if (/^(https?:|data:)/.test(v)) return v;
      const { data } = await admin.storage.from("form-assets").createSignedUrl(v, 600);
      return data?.signedUrl ?? null;
    };

    return json({
      ok: true,
      teacher_sig: await sign(r.teacher_sig),
      deputy_sig: await sign(r.deputy_sig),
      counselor_sig: await sign(r.counselor_sig),
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
};
