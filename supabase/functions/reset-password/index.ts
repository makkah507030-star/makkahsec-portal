import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// كلمة مرور مؤقتة عشوائية (كانت رقم الهوية فيبقى الحساب مكشوفًا حتى يغيّرها صاحبه):
// 8 رموز بلا الملتبسة (O/0، I/l/1) في مقطعين، مثل K7mQ-42Tq، ويُطلب تغييرها عند أول دخول
const ABC = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const tempPassword = () => {
  const b = crypto.getRandomValues(new Uint32Array(8));
  const s = Array.from(b, (x) => ABC[x % ABC.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4)}`;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "غير مصرّح" }, 401);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const actor = (await userClient.auth.getUser()).data.user;
    if (!actor) return json({ error: "جلسة غير صالحة" }, 401);
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const roles = (await admin.from("admin_roles").select("role_type").eq("user_id", actor.id)).data || [];
    const allowed = roles.some((r) => ["principal", "tech_support"].includes(r.role_type));
    if (!allowed) return json({ error: "هذه العملية للمدير أو الدعم الفني فقط" }, 403);

    const body = await req.json();
    const userId = body.user_id;
    if (!userId) return json({ error: "معرّف المستخدم مطلوب" }, 400);

    const target = (await admin.from("users").select("id, username, full_name, role, is_active")
      .eq("id", userId).maybeSingle()).data;
    if (!target) return json({ error: "المستخدم غير موجود" }, 404);

    // حساب المدير يعيده المدير والدعم الفني، وتُسجَّل العملية باسم المنفّذ في سجل العمليات
    const tr = (await admin.from("admin_roles").select("role_type").eq("user_id", userId)).data || [];
    const targetIsPrincipal = tr.some((r) => r.role_type === "principal");

    const password = tempPassword();
    const pwRes = await admin.auth.admin.updateUserById(userId, { password });
    if (pwRes.error) return json({ error: pwRes.error.message }, 400);

    const flagRes = await admin.from("users").update({ must_change_pw: true }).eq("id", userId);
    if (flagRes.error) return json({ error: flagRes.error.message }, 400);

    if (targetIsPrincipal && userId !== actor.id) {
      // بجلسة المنفّذ: يملأ الخادم اسمه وأدواره (supabase/audit_log.sql)، وفشل التسجيل لا يلغي العملية
      await userClient.from("audit_log").insert({
        action: "إعادة كلمة مرور حساب المدير", level: "high", path: "/password-reset",
        details: [`أُعيدت كلمة مرور ${target.full_name || target.username} إلى كلمة مؤقتة عشوائية`],
      });
    }

    return json({ ok: true, full_name: target.full_name || target.username, username: target.username, password });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
// نهاية الملف reset-password
