// scripts/restore-storage.mjs
// =====================================================================
//  استرجاع الملفات المرفوعة من نسخة backup-storage.mjs إلى مشروع Supabase:
//  تُنشأ الحاويات الناقصة بإعداداتها (buckets.json)، ثم يُرفع كل ملف
//  مع الكتابة فوق الموجود. تكرار التشغيل آمن.
//
//  التشغيل: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/restore-storage.mjs <مجلد storage>
// =====================================================================

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
}

export async function restoreStorage(client, inDir) {
  const buckets = JSON.parse(readFileSync(join(inDir, "buckets.json"), "utf8"));
  const { data: existing, error } = await client.storage.listBuckets();
  if (error) throw new Error(`قائمة الحاويات: ${error.message}`);
  const have = new Set(existing.map((b) => b.name));

  let total = 0;
  for (const b of buckets) {
    if (!have.has(b.name)) {
      const { error: e } = await client.storage.createBucket(b.name, {
        public: b.public,
        ...(b.file_size_limit ? { fileSizeLimit: b.file_size_limit } : {}),
        ...(b.allowed_mime_types ? { allowedMimeTypes: b.allowed_mime_types } : {}),
      });
      if (e) throw new Error(`إنشاء الحاوية ${b.name}: ${e.message}`);
    }
    const root = join(inDir, b.name);
    let files = [];
    try { files = walk(root); } catch { /* حاوية فارغة */ }
    for (const f of files) {
      const path = relative(root, f).split(sep).join("/");
      const { error: e } = await client.storage.from(b.name).upload(path, readFileSync(f), { upsert: true });
      if (e) throw new Error(`رفع ${b.name}/${path}: ${e.message}`);
    }
    console.log(`✓ ${b.name}: ${files.length} ملف`);
    total += files.length;
  }
  return total;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inDir = process.argv[2];
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!inDir || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("الاستخدام: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/restore-storage.mjs <مجلد storage>");
    process.exit(1);
  }
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const n = await restoreStorage(client, inDir);
  console.log(`\nاستُرجع ${n} ملفًا`);
}
