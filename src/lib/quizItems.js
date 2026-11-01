// src/lib/quizItems.js
/* تحليل فقرات الاختبار المصحَّح آليًا: هل أجاب الطالب الفقرة صحيحًا، ونسبة الصواب في كل فقرة لمجموعة طلاب.
   يستعمله «تحليل النتائج» (QuizAnalytics) والخطة العلاجية في دورة الاختبار (QuizCycle) لملء مهاراتها. */

export const clean = (v) => (typeof v === "string" ? v.replace(/^"|"$/g, "") : v);

/** صواب الإجابة: 1 أو 0، والمزاوجة بنسبة أزواجها الصحيحة، والأنماط المكتوبة null (لا تُحلَّل آليًا) */
export function correctness(q, a) {
  if (!["mcq", "truefalse", "match"].includes(q.kind)) return null;   // المكتوبة لا تُحلَّل، أُجيبت أو لم تُجب
  if (a == null) return 0;
  const key = clean(q.answer);
  if (q.kind === "mcq" || q.kind === "truefalse") return String(clean(a)) === String(key) ? 1 : 0;
  if (q.kind === "match") {
    const k = key && typeof key === "object" ? key : {};
    const pairs = Object.keys(k);
    if (!pairs.length || typeof a !== "object") return 0;
    return pairs.filter((p) => String(a[p]) === String(k[p])).length / pairs.length;
  }
  return null;
}

/** نسبة الصواب لكل فقرة بين أوراق مجموعة: [{ n: رقم الفقرة، text، pct }] بترتيب الاختبار، بلا الفقرات المكتوبة */
export function itemRates(questions, sheets) {
  const qs = [...questions].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return qs.map((q, i) => {
    const vals = sheets.map((s) => correctness(q, s.answers?.[q.id])).filter((v) => v != null);
    return vals.length ? { n: i + 1, text: String(q.text ?? "").trim(), pct: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) } : null;
  }).filter(Boolean);
}
