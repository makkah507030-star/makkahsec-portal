// scripts/check-functions.mjs
// =====================================================================
//  فحص دوال Netlify قبل النشر: تُحمَّل كل دالة كما يحمّلها الخادم
//  (ES Module، لأن package.json يعلن "type": "module")، ويُتأكَّد أنها
//  تصدّر handler. يلتقط أخطاء مثل require/exports داخل ملف ES Module —
//  الخطأ الذي أوقف نشر الموقع كله سابقًا — قبل أن تصل إلى Netlify.
//
//  التشغيل: npm run check:functions
// =====================================================================

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DIR = resolve("netlify/functions");

// قيم وهمية: بعض الدوال تنشئ عميل Supabase عند التحميل، ولا اتصال فعلي هنا
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "ci-placeholder";

const files = readdirSync(DIR).filter((f) => /\.(m?js|cjs)$/.test(f)).sort();
let failed = 0;

for (const f of files) {
  try {
    const mod = await import(pathToFileURL(join(DIR, f)).href);
    if (typeof mod.handler !== "function") throw new Error("لا تصدّر handler");
    console.log(`✓ ${f}`);
  } catch (e) {
    failed++;
    console.error(`✗ ${f}: ${e?.message || e}`);
  }
}

// كل دالة مجدولة في netlify.toml يجب أن يكون لها ملف — وإلا لا تعمل الجدولة بصمت
const names = new Set(files.map((f) => f.replace(/\.(m?js|cjs)$/, "")));
const toml = readFileSync("netlify.toml", "utf8");
for (const [, name] of toml.matchAll(/^\[functions\."([^"]+)"\]/gm)) {
  if (!names.has(name)) {
    failed++;
    console.error(`✗ netlify.toml يجدول «${name}» ولا يوجد ملف له في netlify/functions`);
  }
}

if (!files.length) { console.error("لا توجد دوال في netlify/functions"); process.exit(1); }
console.log(`\n${files.length - failed}/${files.length} دالة سليمة`);
process.exit(failed ? 1 : 0);
