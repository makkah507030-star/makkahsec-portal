// netlify/functions/dfile-doc.js
// =====================================================================
//  بوابة مكة الثانوية الرقمية — ملف المعلم الرقمي
//  يعيد رابطًا مؤقتًا (5 دقائق) لشاهد رفعه المعلم، ليعاينه زائر ملفه دون دخول.
//  يتحقق أن الكود لملف مفعّل، وأن قسم الشواهد غير مخفي، وأن الشاهد مرفوع
//  من المعلم صاحب الملف نفسه. مخزن الشواهد يبقى خاصًا.
// =====================================================================

import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body, status = 200) => ({
  statusCode: status,
  headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { code, id } = JSON.parse(event.body || "{}");
    if (!code || !id) return json({ error: "الطلب ناقص" }, 400);

    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: f } = await admin.from("teacher_dfiles")
      .select("teacher_user_id, hidden, disabled_at")
      .eq("code", String(code).trim().toUpperCase()).maybeSingle();
    if (!f || f.disabled_at || (f.hidden ?? []).includes("docs")) return json({ error: "الملف غير متاح" }, 404);

    const { data: ev } = await admin.from("perf_evidence")
      .select("file_path, source, teacher_user_id")
      .eq("id", id).maybeSingle();
    if (!ev || ev.teacher_user_id !== f.teacher_user_id || ev.source !== "upload" || !ev.file_path) {
      return json({ error: "الشاهد غير موجود" }, 404);
    }

    const { data: signed, error } = await admin.storage.from("perf-evidence").createSignedUrl(ev.file_path, 300);
    if (error || !signed?.signedUrl) return json({ error: "تعذّر فتح الشاهد" }, 500);
    // اسم الملف الأصلي لا يُرسل للزائر؛ يكفيه عنوان الشاهد
    return json({ url: signed.signedUrl });
  } catch {
    return json({ error: "تعذّر فتح الشاهد" }, 500);
  }
};
