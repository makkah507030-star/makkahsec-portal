// create-admin-account: إنشاء حساب عضو إدارة أو تعديل أدواره (صفحة «الإدارة» ← الأعضاء).
// يقبل كل الأدوار الإدارية في قاعدة البيانات، ومنها المخصّصة custom_1..custom_10.
// • حساب جديد: البريد = رقم الهوية@makkahsec.com وكلمة المرور الأولية = رقم الهوية.
// • حساب قائم (معلم أو عضو إدارة): تُستبدل أدواره، فيصبح دوره admin ما دام له دور إداري،
//   ويعود المعلم teacher إن أُزيلت كل أدواره.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const EMAIL_DOMAIN = "@makkahsec.com";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "غير مصرّح" }, 401);
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const actor = (await userClient.auth.getUser()).data.user;
    if (!actor) return json({ error: "جلسة غير صالحة" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });

    // الصلاحية: مدير أو دعم فني، أو دور يملك صلاحية "accounts"
    const mine = ((await admin.from("admin_roles").select("role_type").eq("user_id", actor.id)).data || []).map((r: any) => r.role_type);
    let allowed = mine.includes("principal") || mine.includes("tech_support");
    if (!allowed && mine.length) {
      allowed = ((await admin.from("role_permissions").select("role_type").eq("permission", "accounts").in("role_type", mine)).data || []).length > 0;
    }
    if (!allowed) return json({ error: "هذه العملية للمدير أو الدعم الفني فقط" }, 403);

    const body = await req.json().catch(() => ({}));
    const fullName = String(body.full_name || "").trim();
    const nid = String(body.national_id || "").trim();
    const roles: string[] = [...new Set((Array.isArray(body.admin_roles) ? body.admin_roles : []).map((r: unknown) => String(r)))];
    if (!/^\d{10}$/.test(nid)) return json({ error: "رقم الهوية 10 أرقام" }, 400);
    if (fullName.length < 3) return json({ error: "اكتب الاسم الكامل" }, 400);
    const bad = roles.find((r) => !/^[a-z0-9_]+$/.test(r));
    if (bad) return json({ error: `دور إداري غير معروف: ${bad}` }, 400);
    // منح دور المدير أو الدعم الفني للمدير والدعم الفني وحدهما
    if (roles.some((r) => r === "principal" || r === "tech_support") && !mine.includes("principal") && !mine.includes("tech_support")) {
      return json({ error: "منح هذا الدور للمدير أو الدعم الفني فقط" }, 403);
    }

    // الحساب: موجود باسم المستخدم، أو يُنشأ
    let created = false;
    let { data: user } = await admin.from("users").select("id, role, full_name").eq("username", nid).maybeSingle();
    if (user && !["admin", "teacher"].includes(user.role)) return json({ error: "رقم الهوية مسجّل لحساب طالب أو ولي أمر" }, 400);
    if (!user) {
      const email = nid + EMAIL_DOMAIN;
      const made = await admin.auth.admin.createUser({ email, password: nid, email_confirm: true });
      let uid = made.data?.user?.id ?? null;
      if (made.error) {
        if (!/already|exists|registered/i.test(String(made.error.message))) return json({ error: made.error.message }, 400);
        for (let page = 1; page <= 50 && !uid; page++) {   // محاولة سابقة انقطعت: نربط حساب Auth الموجود
          const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
          uid = (data?.users || []).find((u) => u.email?.toLowerCase() === email)?.id ?? null;
          if ((data?.users || []).length < 1000) break;
        }
      }
      if (!uid) return json({ error: "تعذّر إنشاء الحساب" }, 400);
      const ins = await admin.from("users").upsert(
        { id: uid, username: nid, full_name: fullName, role: "admin", is_active: true, must_change_pw: true }, { onConflict: "id" });
      if (ins.error) return json({ error: ins.error.message }, 400);
      user = { id: uid, role: "admin", full_name: fullName };
      created = true;
    }

    // الأدوار: تُستبدل كلها (والقيمة غير الموجودة في قاعدة البيانات يرفضها الإدراج)
    const del = await admin.from("admin_roles").delete().eq("user_id", user.id);
    if (del.error) return json({ error: del.error.message }, 400);
    if (roles.length) {
      const add = await admin.from("admin_roles").insert(roles.map((r) => ({ user_id: user!.id, role_type: r })));
      if (add.error && created) {   // لا يبقى حساب جديد بلا أدوار
        await admin.from("users").delete().eq("id", user.id);
        await admin.auth.admin.deleteUser(user.id);
      }
      if (add.error) return json({ error: /enum|invalid input value/i.test(add.error.message) ? "دور إداري غير معروف — شغّل custom_roles_1.sql" : add.error.message }, 400);
    }
    const isTeacher = ((await admin.from("teachers").select("id").eq("user_id", user.id)).data || []).length > 0;
    const role = roles.length ? "admin" : isTeacher ? "teacher" : "admin";
    if (role !== user.role) {
      const up = await admin.from("users").update({ role }).eq("id", user.id);
      if (up.error) return json({ error: up.error.message }, 400);
    }
    return json({ ok: true, full_name: user.full_name || fullName });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
// نهاية الملف create-admin-account
