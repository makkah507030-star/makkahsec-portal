import { createClient } from "@supabase/supabase-js";
import { trackedFetch } from "./notice";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // رسالة واضحة بدل شاشة بيضاء
  console.error(
    "لم يتم ضبط إعدادات Supabase. أنشئ ملف .env بجانب package.json وضع فيه " +
      "VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY ثم أعد تشغيل npm run dev"
  );
}

export const supabase = createClient(url ?? "", key ?? "", {
  auth: { persistSession: true, autoRefreshToken: true },
  // لمعرفة متى يجري حفظ أو تحميل يطول — تُظهره طبقة التنبيهات العامة
  global: { fetch: trackedFetch },
});

export const isConfigured = Boolean(url && key);

/** اسم المستخدم = رقم الهوية. Supabase Auth يحتاج بريدًا، فنبني بريدًا داخليًا ثابتًا. */
export const idToEmail = (nationalId) =>
  `${String(nationalId).trim()}@makkahsec.com`;

/** كلمة المرور الأولية: اسم المستخدم نفسه، والرقم الأقصر من 6 خانات (طالب برقم مؤقت)
 *  يُكمَّل بأصفار من اليسار حتى 10 خانات — 15660 ← 0000015660.
 *  القاعدة نفسها في supabase/functions/create-accounts و reset-password. */
export const initialPassword = (username) => {
  const u = String(username ?? "").trim();
  return /^\d+$/.test(u) && u.length < 6 ? u.padStart(10, "0") : u;
};

/** ما يكتبه المستخدم في خانة الدخول: الأصفار البادئة تُحذف عن الرقم القصير
 *  (0000015660 ← 15660)، ولا يبدأ رقم هوية أو إقامة أو جوال مسجّل بصفر. */
export const normalizeLogin = (v) => {
  const s = String(v ?? "").trim();
  const bare = s.replace(/^0+/, "");
  return /^\d+$/.test(s) && bare && bare.length < 6 ? bare : s;
};
