// src/lib/qbank.js
/* =====================================================================
   بنك الأسئلة (supabase/qbank_1..2.sql) — التسميات المشتركة، ونسخ الأسئلة إلى اختبار
   (من البنك أو من اختبار آخر) بصورها، فيستعملها «استيراد أسئلة» و«إضافة من البنك».
   ===================================================================== */
import { supabase } from "./supabase";

export const KIND_LABEL = { mcq: "اختيار من متعدد", truefalse: "صح وخطأ", match: "مزاوجة", fill: "أكمل الفراغ",
  order: "رتّب", short: "أجب باختصار", essay: "مقالي" };
export const DIFFICULTY = [
  { k: "easy", t: "سهل", c: "bg-present/10 text-present" },
  { k: "medium", t: "متوسط", c: "bg-late/10 text-late" },
  { k: "hard", t: "صعب", c: "bg-absent/10 text-absent" },
];
export const diffOf = (k) => DIFFICULTY.find((d) => d.k === k);
export const preview = (t, n = 140) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, n) || "(بلا نص)";

/** الإجابة الصحيحة بنص مقروء (للاختيار من متعدد وصح وخطأ)، وإلا null */
export function answerText(q) {
  const a = q?.answer;
  if (q?.kind === "truefalse") return a === true || a === "true" ? "صح" : "خطأ";
  if (q?.kind === "mcq" && Array.isArray(q.options)) {
    const i = Number(Array.isArray(a) ? a[0] : a);
    return Number.isInteger(i) ? q.options[i] ?? null : null;
  }
  return null;
}

/* نسخ صورة إلى مجلد الاختبار؛ عند التعذّر يُكمل السؤال بلا صورة */
async function copyImage(quizId, path) {
  if (!path) return null;
  const to = `${quizId}/import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${path.split(".").pop()}`;
  const { error } = await supabase.storage.from("quiz-images").copy(path, to);
  return error ? undefined : to;
}

/** يضيف نسخًا من الأسئلة إلى الاختبار بعد آخر سؤال؛ يعيد { data, error, lostImages } */
export async function copyQuestionsInto(quiz, rows, nextOrder) {
  let lostImages = 0;
  const payload = [];
  for (const [i, r] of rows.entries()) {
    const { id: _id, quiz_id: _q, created_at: _c, updated_at: _u, sort_order: _s, ...rest } = r;
    const row = { ...rest, quiz_id: quiz.id, sort_order: nextOrder + i };
    if (r.image_path) { row.image_path = await copyImage(quiz.id, r.image_path); if (row.image_path === undefined) { row.image_path = null; lostImages++; } }
    if (Array.isArray(r.option_images) && r.option_images.some(Boolean)) {
      if (quiz.mode === "paper") row.option_images = null;   // الورقي لا يعرض صور الخيارات
      else row.option_images = await Promise.all(r.option_images.map(async (p) => {
        const c = await copyImage(quiz.id, p); if (c === undefined) lostImages++; return c ?? null;
      }));
    }
    payload.push(row);
  }
  const { data, error } = await supabase.from("quiz_questions").insert(payload).select();
  return { data: data ?? [], error, lostImages };
}
