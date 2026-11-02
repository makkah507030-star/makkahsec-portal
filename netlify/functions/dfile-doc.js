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

    // ملف محضر المعمل برمز ML- (supabase/lab_dfile_1.sql)، وغيره ملف معلم
    const c = String(code).trim().toUpperCase();
    const lab = c.startsWith("ML-");
    const { data: f } = lab
      ? await admin.from("lab_dfiles").select("teacher_user_id:user_id, hidden, disabled_at").eq("code", c).maybeSingle()
      : await admin.from("teacher_dfiles").select("teacher_user_id, hidden, disabled_at").eq("code", c).maybeSingle();
    if (!f || f.disabled_at || (f.hidden ?? []).includes("docs")) return json({ error: "الملف غير متاح" }, 404);

    const { data: ev } = await admin.from("perf_evidence")
      .select("file_path, source, teacher_user_id, item_key")
      .eq("id", id).maybeSingle();
    // ملف المحضر يعرض شواهد بنوده (l..) وحدها، وملف المعلم شواهد بنود المعلم
    if (!ev || ev.teacher_user_id !== f.teacher_user_id || ev.source !== "upload" || !ev.file_path
        || /^l\d/.test(ev.item_key ?? "") !== lab) {
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
