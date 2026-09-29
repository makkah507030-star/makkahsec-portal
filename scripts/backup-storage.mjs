// scripts/backup-storage.mjs
// =====================================================================
//  نسخ الملفات المرفوعة في Supabase Storage (كل الحاويات) إلى مجلد محلي،
//  لأن نسخ Supabase الاحتياطية لا تشمل الملفات. يستخدمه سير العمل
//  .github/workflows/backup.yml، والمسار: <المجلد>/<الحاوية>/<مسار الملف>،
//  وإعدادات الحاويات في <المجلد>/buckets.json. الاسترجاع: restore-storage.mjs
//
//  التشغيل: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/backup-storage.mjs <المجلد>
// =====================================================================

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const PAGE = 1000;

// كل ملفات الحاوية، بالنزول في المجلدات (المجلد في Storage عنصر بلا id)
async function listAll(bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await bucket.list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`قائمة «${prefix || "/"}»: ${error.message}`);
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) files.push(path);
      else files.push(...(await listAll(bucket, path)));
    }
    if (data.length < PAGE) return files;
  }
}

export async function backupStorage(client, outDir) {
  const { data: buckets, error } = await client.storage.listBuckets();
  if (error) throw new Error(`قائمة الحاويات: ${error.message}`);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "buckets.json"), JSON.stringify(buckets.map((b) => ({
    name: b.name, public: b.public,
    file_size_limit: b.file_size_limit ?? null, allowed_mime_types: b.allowed_mime_types ?? null,
  })), null, 2));

  let total = 0;
  for (const b of buckets) {
    const bucket = client.storage.from(b.name);
    const paths = await listAll(bucket);
    for (const p of paths) {
      const { data: blob, error: e } = await bucket.download(p);
      if (e) throw new Error(`تنزيل ${b.name}/${p}: ${e.message}`);
      const dest = join(outDir, b.name, p);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, Buffer.from(await blob.arrayBuffer()));
    }
    console.log(`✓ ${b.name}: ${paths.length} ملف`);
    total += paths.length;
  }
  return total;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outDir = process.argv[2];
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!outDir || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("الاستخدام: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/backup-storage.mjs <المجلد>");
    process.exit(1);
  }
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const n = await backupStorage(client, outDir);
  console.log(`\nنُسخ ${n} ملفًا`);
}
