import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// القاعدة نفسها في create-accounts: المعرّف الرقمي الأقصر من 6 خانات يُكمَّل بأصفار حتى 10
const initialPassword = (u) => (/^\d+$/.test(u) && u.length < 6 ? u.padStart(10, "0") : u);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "غير مصرّح" }, 401);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const userRes = await userClient.auth.getUser();
    const actor = userRes.data.user;
    if (!actor) return json({ error: "جلسة غير صالحة" }, 401);

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const rolesRes = await admin
      .from("admin_roles")
      .select("role_type")
      .eq("user_id", actor.id);

    const roles = rolesRes.data || [];
    const actorIsPrincipal = roles.some((r) => r.role_type === "principal");
    const allowed = actorIsPrincipal || roles.some((r) => r.role_type === "tech_support");

    if (!allowed) {
      return json({ error: "هذه العملية للمدير أو الدعم الفني فقط" }, 403);
    }

    const body = await req.json();
    const userId = body.user_id;
    if (!userId) return json({ error: "معرّف المستخدم مطلوب" }, 400);

    const targetRes = await admin
      .from("users")
      .select("id, username, full_name, role, is_active")
      .eq("id", userId)
      .maybeSingle();

    const target = targetRes.data;
    if (!target) return json({ error: "المستخدم غير موجود" }, 404);

    if (target.role === "admin" && !actorIsPrincipal) {
      const trRes = await admin
        .from("admin_roles")
        .select("role_type")
        .eq("user_id", userId);

      const targetIsPrincipal = (trRes.data || []).some(
        (r) => r.role_type === "principal"
      );

      if (targetIsPrincipal) {
        return json({ error: "لا يمكن إعادة تعيين حساب المدير" }, 403);
      }
    }

    const password = initialPassword(String(target.username ?? "").trim());
    const pwRes = await admin.auth.admin.updateUserById(userId, { password });
    if (pwRes.error) return json({ error: pwRes.error.message }, 400);

    const flagRes = await admin
      .from("users")
      .update({ must_change_pw: true })
      .eq("id", userId);
    if (flagRes.error) return json({ error: flagRes.error.message }, 400);

    return json({
      ok: true,
      full_name: target.full_name || target.username,
      username: target.username,
      password,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
