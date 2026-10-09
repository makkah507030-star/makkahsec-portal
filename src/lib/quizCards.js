import { supabase } from "./supabase";

/* =====================================================================
   صورة بطاقة الإجابة بعد التصحيح بالكاميرا (supabase/quiz_cards.sql).
   تُحفظ البطاقة المعدولة التي يراجعها المعلم (بالرمادي وعليها دوائر القراءة)،
   مصغّرة إلى 900 بكسل عرضًا بجودة متوسطة (نحو 50 ك.ب)، لا صورة الجوال الأصلية.
   ===================================================================== */

export const CARDS_BUCKET = "quiz-cards";
const MAX_W = 900;

// صورة المعاينة (dataURL) ← ملف JPEG مصغّر
function shrinkDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, MAX_W / img.width);
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error("تعذّر تجهيز صورة البطاقة"))), "image/jpeg", 0.6);
    };
    img.onerror = () => reject(new Error("تعذّر تجهيز صورة البطاقة"));
    img.src = dataUrl;
  });
}

/** يحفظ صورة بطاقة الطالب ويربطها برصده، ويحذف صورته السابقة إن وُجدت.
    لا يُفشل الرصد: يعيد رسالة الخطأ أو null. */
export async function saveQuizCard(quizId, sub, dataUrl) {
  if (!sub?.id || !dataUrl) return null;
  try {
    const blob = await shrinkDataUrl(dataUrl);
    const path = `${quizId}/${sub.student_id}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from(CARDS_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw error;
    const { error: e2 } = await supabase.from("quiz_submissions").update({ card_path: path }).eq("id", sub.id);
    if (e2) { await supabase.storage.from(CARDS_BUCKET).remove([path]); throw e2; }
    if (sub.card_path && sub.card_path !== path) await supabase.storage.from(CARDS_BUCKET).remove([sub.card_path]);
    return null;
  } catch (e) {
    return /bucket|card_path|schema cache|not found/i.test(e?.message ?? "")
      ? "رُصدت الدرجة، ولم تُحفظ صورة البطاقة: يلزم تشغيل ملف supabase/quiz_cards.sql."
      : `رُصدت الدرجة، ولم تُحفظ صورة البطاقة: ${e?.message ?? ""}`;
  }
}

/** يفتح صورة البطاقة برابط مؤقت. التبويب يُفتح قبل الانتظار حتى لا يحجبه الجوال. */
export async function openQuizCard(path) {
  const win = window.open("", "_blank");
  const { data } = await supabase.storage.from(CARDS_BUCKET).createSignedUrl(path, 300);
  if (!data?.signedUrl) {
    if (win) win.close();
    alert("تعذّر فتح صورة البطاقة.");
    return;
  }
  if (win) win.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}

/** يحذف صور بطاقات اختبار كامل (عند حذف الاختبار) */
export async function removeQuizCards(quizId) {
  const { data } = await supabase.storage.from(CARDS_BUCKET).list(quizId, { limit: 1000 });
  const paths = (data ?? []).map((f) => `${quizId}/${f.name}`);
  if (paths.length) await supabase.storage.from(CARDS_BUCKET).remove(paths);
}

/** صور البطاقات تُحذف بنهاية الفصل الدراسي: عند فتح المعلم «اختباراتي» تُحذف
    صور بطاقات اختباراته من الفصول السابقة، وتبقى الدرجات والإجابات. مرة في الجلسة. */
export async function purgeOldQuizCards(quizzes, year, term) {
  const key = `quiz-cards-purged:${year}:${term}`;
  try { if (sessionStorage.getItem(key)) return; } catch { /* المتصفح يمنع التخزين */ }
  const old = (quizzes ?? []).filter((q) => q.academic_year && (q.academic_year !== year || Number(q.term) !== Number(term)))
    .map((q) => q.id);
  for (let i = 0; i < old.length; i += 100) {
    const { data, error } = await supabase.from("quiz_submissions")
      .select("id, card_path").in("quiz_id", old.slice(i, i + 100)).not("card_path", "is", null);
    if (error) return;   // قبل تشغيل ملف quiz_cards.sql
    const paths = (data ?? []).map((r) => r.card_path);
    for (let j = 0; j < paths.length; j += 100) {
      await supabase.storage.from(CARDS_BUCKET).remove(paths.slice(j, j + 100));
    }
    if (data?.length) await supabase.from("quiz_submissions").update({ card_path: null }).in("id", data.map((r) => r.id));
  }
  try { sessionStorage.setItem(key, "1"); } catch { /* لا بأس */ }
}
