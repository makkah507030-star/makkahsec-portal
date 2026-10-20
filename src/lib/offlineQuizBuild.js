// src/lib/offlineQuizBuild.js
// تجهيز حزمة الاختبار دون إنترنت في متصفح المعلم: الأسئلة بلا الإجابات الصحيحة، وصورها
// ومقطع الاستماع مضمّنة، مشفّرة بمفتاح جديد (src/lib/offlineQuiz.js)، ثم quiz_offline_save.
import { supabase } from "./supabase";
import { encryptPackage, newKey } from "./offlineQuiz.js";

const blobToDataUrl = (blob) => new Promise((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(r.result); r.onerror = fail;
  r.readAsDataURL(blob);
});

// الصور الكبيرة تُصغَّر (عرض 1400 بكسل كحد أقصى) لتبقى الحزمة خفيفة على جوال الطالب
async function shrink(blob) {
  if (blob.size < 250_000 || !blob.type.startsWith("image/") || blob.type === "image/svg+xml") return blob;
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, 1400 / bmp.width);
    const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.85));
    return out && out.size < blob.size ? out : blob;
  } catch { return blob; }
}

async function fetchAll(bucket, paths) {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, 600);
  if (error) throw new Error(`تعذّر تحميل الصور: ${error.message}`);
  const out = {};
  for (const x of data ?? []) {
    if (!x.signedUrl) continue;
    const blob = await (await fetch(x.signedUrl)).blob();
    out[x.path] = await blobToDataUrl(bucket === "quiz-images" ? await shrink(blob) : blob);
  }
  return out;
}

/** يجهّز الحزمة ويحفظها، ويعيد { ver, sizeKb } */
export async function buildOfflinePackage(quiz) {
  const { data: rows, error } = await supabase.from("quiz_questions")
    .select("id, kind, text, marks, options, sort_order, listening, image_path, option_images")
    .eq("quiz_id", quiz.id).order("sort_order").order("created_at");
  if (error) throw error;
  if (!rows?.length) throw new Error("لا توجد أسئلة في الاختبار");

  const paths = [...new Set(rows.flatMap((q) => [q.image_path, ...(q.option_images ?? [])]).filter(Boolean))];
  const imgs = await fetchAll("quiz-images", paths);
  let audio = null;
  if (quiz.listening_audio && rows.some((q) => q.listening)) {
    audio = (await fetchAll("quiz-audio", [quiz.listening_audio]))[quiz.listening_audio] ?? null;
  }

  const qs = rows.map((q) => ({
    id: q.id, kind: q.kind, text: q.text, marks: q.marks, options: q.options, listening: !!q.listening,
    img: q.image_path ? imgs[q.image_path] ?? null : null,
    optImgs: Array.isArray(q.option_images) && q.option_images.some(Boolean) ? q.option_images.map((p) => (p ? imgs[p] ?? null : null)) : null,
  }));
  const key = newKey();
  const pkg = await encryptPackage({ qs, audio }, key);
  const { data, error: e2 } = await supabase.rpc("quiz_offline_save", {
    p_quiz: quiz.id, p_key: key, p_package: pkg, p_qids: qs.map((q) => q.id),
  });
  if (e2) throw e2;
  return { ver: data?.ver, sizeKb: Math.round(pkg.length / 1024) };
}
