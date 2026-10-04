// scripts/staging-users.mjs
// ينشئ حسابات الدخول التجريبية في Supabase Auth للنسخة التجريبية فقط،
// بمعرّفات ثابتة تطابق supabase/staging/seed.sql. قابل لإعادة التشغيل:
// الحساب الموجود تُعاد كلمة مروره فقط.
//
// المتغيرات: STAGING_SUPABASE_URL وSTAGING_SERVICE_ROLE_KEY وSTAGING_PASSWORD
import { createClient } from "@supabase/supabase-js";

const url = process.env.STAGING_SUPABASE_URL;
const key = process.env.STAGING_SERVICE_ROLE_KEY;
const password = process.env.STAGING_PASSWORD;
if (!url || !key || !password) {
  console.error("المتغيرات ناقصة: STAGING_SUPABASE_URL وSTAGING_SERVICE_ROLE_KEY وSTAGING_PASSWORD");
  process.exit(1);
}

// حارس: لا يعمل على قاعدة البوابة الحقيقية حتى لو وُضعت مفاتيحها بالخطأ
if (process.env.PROD_SUPABASE_URL && url.replace(/\/+$/, "") === process.env.PROD_SUPABASE_URL.replace(/\/+$/, "")) {
  console.error("هذا رابط قاعدة البيانات الحقيقية — توقّف الإعداد.");
  process.exit(1);
}

const ACCOUNTS = [
  ["00000000-0000-4000-a000-000000000001", "9000000001"],
  ["00000000-0000-4000-a000-000000000002", "9000000002"],
  ["00000000-0000-4000-a000-000000000011", "9000000011"],
  ["00000000-0000-4000-a000-000000000012", "9000000012"],
  ["00000000-0000-4000-a000-000000000013", "9000000013"],
  ["00000000-0000-4000-a000-000000000014", "9000000014"],
  ["00000000-0000-4000-a000-000000000101", "9000000101"],
  ["00000000-0000-4000-a000-000000000201", "9000000201"],
];

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let failed = false;
for (const [id, nid] of ACCOUNTS) {
  const email = `${nid}@makkahsec.com`;
  const { data: got } = await admin.auth.admin.getUserById(id);
  const { error } = got?.user
    ? await admin.auth.admin.updateUserById(id, { password, email_confirm: true })
    : await admin.auth.admin.createUser({ id, email, password, email_confirm: true });
  if (error) { failed = true; console.error(`✗ ${nid}: ${error.message}`); }
  else console.log(`✓ ${nid}`);
}
process.exit(failed ? 1 : 0);
