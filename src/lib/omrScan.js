// src/lib/omrScan.js
import { CARD_VERSIONS, cardLayout } from "./omrLayout.js";
import { imageFromFile, readCard } from "./omrReader.js";

/* =====================================================================
   قراءة صورة بطاقة بأفضل شكل — مشتركة بين التصوير الفردي (QuizScan)
   والتصحيح الجماعي (QuizBatchScan): تُقرأ بالشكل الحالي وبالأشكال السابقة
   (أوراق طُبعت قبل آخر تحديث)، ويؤخذ الأوضح: أكثر صفوف مقروءة بثقة.
   ===================================================================== */

/** الشكل الحالي والأشكال السابقة المختلفة عنه */
export function cardLayouts(questions, ltr) {
  const current = cardLayout(questions, { ltr });
  const sig = (l) => JSON.stringify(l.rows.map((r) => r.bubbles[0])) + l.H;
  const seen = new Set([sig(current)]);
  const older = CARD_VERSIONS.slice(1).map((version) => cardLayout(questions, { ltr, version }))
    .filter((l) => !seen.has(sig(l)) && seen.add(sig(l)));
  return { current, older };
}

/** { ok, layout, result } أو { ok: false, error } */
export async function readCardFile(file, { current, older }) {
  const img = await imageFromFile(file);
  // نترك للمتصفح فرصة لتحديث الشاشة قبل المعالجة
  await new Promise((r) => setTimeout(r, 30));
  const tries = [current, ...older].map((l) => ({ l, r: readCard(img, l) })).filter((x) => x.r.ok);
  if (!tries.length) return { ok: false, error: readCard(img, current, { preview: false }).error };
  const clarity = ({ r }) => r.rows.reduce((a, x) => a + (x.status === "ok" ? 1 : 0)
    + (x.pick != null ? x.scores[x.pick] : 0) / 100, 0);
  const best = tries.reduce((a, x) => (clarity(x) > clarity(a) ? x : a));
  return { ok: true, layout: best.l, result: best.r };
}
