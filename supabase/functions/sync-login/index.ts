import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// مزامنة حساب الدخول مع السجل بعد إضافته أو تعديله من «تعديل السجلات»:
// • سجل بلا حساب ← يُنشأ حسابه (اسم المستخدم رقم الهوية، وللولي الجوال).
// • تغيّر رقم الهوية/الجوال ← يُنقل الحساب نفسه للرقم الجديد بكلمة مرور أولية.
const EMAIL_DOMAIN = "@makkahsec.com";
// كلمة المرور الأولية = اسم المستخدم، والرقم الأقصر من 6 خانات يُكمَّل بأصفار حتى 10
const initialPassword = (u: string) => (/^\d+$/.test(u) && u.length < 6 ? u.padStart(10, "0") : u);
const TARGETS: Record<string, { key: string; role: string }> = {
  students: { key: "national_id", role: "student" },
  teachers: { key: "national_id", role: "teacher" },
  guardians: { key: "mobile", role: "guardian" } };
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

    // الصلاحية: المدير والدعم الفني، أو دور يملك «تعديل السجلات» أو «الحسابات»
    const roles = ((await admin.from("admin_roles").select("role_type").eq("user_id", actor.id)).data || []).map((r: any) => r.role_type);
    const isSuper = roles.includes("principal") || roles.includes("tech_support");
    let allowed = isSuper;
    if (!allowed && roles.length) {
      const perm = await admin.from("role_permissions").select("role_type").in("permission", ["records", "accounts"]).in("role_type", roles);
      allowed = (perm.data || []).length > 0;
    }
    if (!allowed) return json({ error: "لا تملك صلاحية تعديل السجلات" }, 403);

    const body = await req.json().catch(() => ({}));
    const cfg = TARGETS[String(body.table || "")];
    if (!cfg || !body.id) return json({ error: "طلب غير مكتمل" }, 400);
    const rec = (await admin.from(body.table).select(`id, ${cfg.key}, full_name, user_id`).eq("id", body.id).maybeSingle()).data as any;
    if (!rec) return json({ error: "السجل غير موجود" }, 404);

    const username = String(rec[cfg.key] ?? "").trim();
    const fullName = String(rec.full_name ?? "").trim() || username;
    if (!username) return json({ ok: true, skipped: "بلا رقم دخول" });
    const password = initialPassword(username);
    if (password.length < 6) return json({ error: "رقم الدخول أقصر من 6 خانات" }, 400);
    const email = username + EMAIL_DOMAIN;

    // 1) سجل بلا حساب: إنشاؤه وربطه
    if (!rec.user_id) {
      const made = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (made.error) {
        const taken = /already|exists|registered/i.test(String(made.error.message || ""));
        return json({ error: taken ? `رقم الدخول ${username} مستخدم في حساب آخر` : made.error.message }, 400);
      }
      const uid = made.data.user!.id;
      const u = await admin.from("users").upsert(
        { id: uid, username, full_name: fullName, role: cfg.role, is_active: true, must_change_pw: true }, { onConflict: "id" });
      if (u.error) return json({ error: u.error.message }, 400);
      const link = await admin.from(body.table).update({ user_id: uid }).eq("id", rec.id);
      if (link.error) return json({ error: link.error.message }, 400);
      return json({ ok: true, created: true, username, password });
    }

    // 2) حساب موجود: يُنقل للرقم الجديد إن تغيّر — في جدول المستخدمين أو في بريد الدخول نفسه
    const user = (await admin.from("users").select("username, role").eq("id", rec.user_id).maybeSingle()).data as any;
    // سجل مربوط بحساب من نوع آخر (ولي أمر مربوط بحساب معلم أو إداري له أبناء في المدرسة):
    // لا يُمسّ دخول ذلك الحساب ولا اسمه
    if (body.table === "guardians" && user && user.role !== "guardian") return json({ ok: true, skipped: "مربوط بحساب موظف" });
    const authEmail = String((await admin.auth.admin.getUserById(rec.user_id)).data?.user?.email ?? "").toLowerCase();
    if (user && String(user.username ?? "").trim() === username && authEmail === email.toLowerCase()) {
      await admin.from("users").update({ full_name: fullName }).eq("id", rec.user_id);
      return json({ ok: true, unchanged: true });
    }
    // حسابات الإدارة لا ينقلها إلا المدير والدعم الفني
    if (user?.role === "admin" && !isSuper) return json({ error: "حساب إداري — يعدّله المدير أو الدعم الفني" }, 403);
    const upd = await admin.auth.admin.updateUserById(rec.user_id, { email, password, email_confirm: true });
    if (upd.error) {
      const taken = /already|exists|registered/i.test(String(upd.error.message || ""));
      return json({ error: taken ? `رقم الدخول ${username} مستخدم في حساب آخر` : upd.error.message }, 400);
    }
    const u = await admin.from("users").update({ username, full_name: fullName, must_change_pw: true }).eq("id", rec.user_id);
    if (u.error) return json({ error: u.error.message }, 400);
    return json({ ok: true, moved: true, from: authEmail.replace(EMAIL_DOMAIN, "") || user?.username || null, username, password });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
// نهاية الملف sync-login
