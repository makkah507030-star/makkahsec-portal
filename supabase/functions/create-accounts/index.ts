import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL_DOMAIN = "@makkahsec.com";

// كلمة المرور الأولية: اسم المستخدم نفسه، والمعرّف الرقمي الأقصر من 6 خانات
// (طلاب بلا هوية برقم مؤقت) يُكمَّل بأصفار من اليسار حتى 10 خانات — 15660 ← 0000015660.
// القاعدة نفسها في reset-password.
const initialPassword = (u: string) => (/^\d+$/.test(u) && u.length < 6 ? u.padStart(10, "0") : u);

// إعداد كل نوع: الجدول، عمود المعرّف (اسم المستخدم)، ودور الحساب في users
const TARGETS: Record<string, { table: string; key: string; role: string }> = {
  teachers:  { table: "teachers",  key: "national_id", role: "teacher"  },
  students:  { table: "students",  key: "national_id", role: "student"  },
  guardians: { table: "guardians", key: "mobile",      role: "guardian" },
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "غير مصرّح" }, 401);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const actor = (await userClient.auth.getUser()).data.user;
    if (!actor) return json({ error: "جلسة غير صالحة" }, 401);

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // الصلاحية: مدير أو دعم فني، أو دور يملك صلاحية "accounts"
    const rolesRes = await admin.from("admin_roles").select("role_type").eq("user_id", actor.id);
    const roleTypes = (rolesRes.data || []).map((r: any) => r.role_type);
    let allowed = roleTypes.includes("principal") || roleTypes.includes("tech_support");
    if (!allowed && roleTypes.length) {
      const perm = await admin
        .from("role_permissions")
        .select("role_type")
        .eq("permission", "accounts")
        .in("role_type", roleTypes);
      allowed = (perm.data || []).length > 0;
    }
    if (!allowed) return json({ error: "هذه العملية للمدير أو الدعم الفني فقط" }, 403);

    const body = await req.json().catch(() => ({}));
    const target = String(body.target || "");
    const cfg = TARGETS[target];
    if (!cfg) return json({ error: "نوع غير معروف" }, 400);

    // جلب كل السجلات النشطة بلا حساب (مع ترقيم الصفحات لتجاوز سقف 1000)
    const records: any[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await admin
        .from(cfg.table)
        .select(`id, ${cfg.key}, full_name`)
        .eq("is_active", true)
        .is("user_id", null)
        .range(from, from + pageSize - 1);
      if (error) return json({ error: error.message }, 400);
      const rows = data || [];
      records.push(...rows);
      if (rows.length < pageSize) break;
    }

    let created = 0;
    const failures: { name: string; login: string; reason: string }[] = [];

    // لجلب حساب Auth موجود مسبقًا عند تعارض البريد (يُحمَّل مرة واحدة عند الحاجة)
    let authIndex: Map<string, string> | null = null;
    const loadAuthIndex = async () => {
      if (authIndex) return authIndex;
      authIndex = new Map();
      for (let page = 1; page <= 50; page++) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        const users = data?.users || [];
        for (const u of users) if (u.email) authIndex.set(u.email.toLowerCase(), u.id);
        if (users.length < 1000) break;
      }
      return authIndex;
    };

    for (const rec of records) {
      const username = String(rec[cfg.key] ?? "").trim();
      let fullName = String(rec.full_name ?? "").trim();
      if (!fullName) fullName = username; // لا نُعطّل السجل بسبب اسم فارغ

      if (!username) {
        failures.push({ name: fullName || "—", login: "—", reason: "المعرّف فارغ (رقم الهوية/الجوال)" });
        continue;
      }
      const password = initialPassword(username);
      if (password.length < 6) {
        failures.push({ name: fullName, login: username, reason: "المعرّف أقصر من 6 خانات وليس رقمًا يُكمَّل بالأصفار" });
        continue;
      }

      const email = username + EMAIL_DOMAIN;
      let uid: string | null = null;

      const made = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (made.error) {
        const msg = String(made.error.message || "");
        if (/already|exists|registered/i.test(msg)) {
          // حساب Auth موجود مسبقًا (محاولة سابقة انقطعت) — نربطه بدل إعادة إنشائه
          const idx = await loadAuthIndex();
          uid = idx.get(email.toLowerCase()) ?? null;
          if (!uid) { failures.push({ name: fullName, login: username, reason: "حساب موجود مسبقًا وتعذّر العثور عليه" }); continue; }
        } else {
          failures.push({ name: fullName, login: username, reason: msg });
          continue;
        }
      } else {
        uid = made.data?.user?.id ?? null;
      }
      if (!uid) { failures.push({ name: fullName, login: username, reason: "تعذّر إنشاء الحساب" }); continue; }

      // صف users (الملف والدور) + ربط السجل
      const uRes = await admin.from("users").upsert(
        { id: uid, username, full_name: fullName, role: cfg.role, is_active: true, must_change_pw: true },
        { onConflict: "id" },
      );
      if (uRes.error) { failures.push({ name: fullName, login: username, reason: uRes.error.message }); continue; }

      const linkRes = await admin.from(cfg.table).update({ user_id: uid }).eq("id", rec.id);
      if (linkRes.error) { failures.push({ name: fullName, login: username, reason: linkRes.error.message }); continue; }

      created += 1;
    }

    return json({ ok: true, target, created, failed: failures.length, failures });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
