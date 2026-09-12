import { createClient } from "@supabase/supabase-js";

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
});

export const isConfigured = Boolean(url && key);

/** اسم المستخدم = رقم الهوية. Supabase Auth يحتاج بريدًا، فنبني بريدًا داخليًا ثابتًا. */
export const idToEmail = (nationalId) =>
  `${String(nationalId).trim()}@makkahsec.com`;
