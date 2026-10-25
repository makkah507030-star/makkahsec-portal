// netlify/functions/site-status-snapshot.js
// =====================================================================
//  بوابة مكة الثانوية الرقمية
//  اللقطة اليومية لملخّص حالة الموقع — تُجدول في netlify.toml
//  (11:55 مساءً بتوقيت السعودية). تحفظ صفًّا في site_status_snapshots
//  يعرضه سجلّ «مؤشرات الموقع»، والمنطق كله في site-metrics.js.
// =====================================================================

import { adminClient, buildSnapshot } from "./site-metrics.js";

export const handler = async () => {
  try {
    const row = await buildSnapshot(adminClient(), "scheduled");
    return { statusCode: 200, body: JSON.stringify({ ok: true, day: row.day, verdict: row.verdict }) };
  } catch (e) {
    console.error("[site-status-snapshot]", e?.message || e);
    return { statusCode: 500, body: JSON.stringify({ error: String(e?.message || e) }) };
  }
};
