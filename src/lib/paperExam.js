// src/lib/paperExam.js
/* =====================================================================
   الاختبار الورقي — أنماط أسئلته وترتيبها في الورقة.
   لا بطاقة تظليل ولا حدود لعدد الأسئلة: الورقة تتوزّع على صفحات A4
   تلقائيًا، ويُرصد الطالب يدويًا فقرةً فقرة.
   ===================================================================== */

export const PAPER_KINDS = [
  { key: "mcq",       label: "اختيار من متعدد", hint: "خيارات يُحيط الطالب الصحيح منها بدائرة" },
  { key: "truefalse", label: "صح وخطأ",         hint: "عبارة يضع أمامها علامة صح أو خطأ" },
  { key: "match",     label: "مزاوجة",          hint: "عمودان يصل الطالب بين عناصرهما" },
  { key: "fill",      label: "أكمل الفراغ",     hint: "عبارة فيها فراغات يكملها الطالب" },
  { key: "order",     label: "رتّب",            hint: "عناصر يرتّبها الطالب بالأرقام" },
  // لم يعد يُضاف (hidden) — يبقى لعرض أسئلة سابقة منه
  { key: "short",     label: "أجب باختصار",     hint: "سؤال بأسطر قليلة للإجابة", hidden: true },
  { key: "essay",     label: "سؤال مقالي",      hint: "سؤال بمساحة واسعة للكتابة" },
];

// ترتيب المجموعات في الورقة: الموضوعي أولًا ثم المقالي
export const PAPER_ORDER = PAPER_KINDS.map((k) => k.key);

export function groupPaper(questions = []) {
  const groups = [];
  PAPER_ORDER.forEach((kind) => {
    const list = questions.filter((q) => q.kind === kind);
    if (list.length) groups.push({ kind, list });
  });
  return groups;
}

// الفراغ في «أكمل»: ثلاث شرطات سفلية أو أكثر
export const BLANK_RE = /_{3,}/g;
export const BLANK = "______";

// عدد أسطر الإجابة الافتراضي، وحدوده
export const LINES = { short: { def: 2, min: 1, max: 6 }, essay: { def: 6, min: 3, max: 16 } };

export const linesOf = (q) => {
  const lim = LINES[q.kind];
  if (!lim) return 0;
  const n = Number(q.options?.lines ?? lim.def);
  return Math.min(lim.max, Math.max(lim.min, n || lim.def));
};

/** «رتّب»: يُدخلها المعلم بالترتيب الصحيح، وتُعرض للطالب مخلوطة خلطًا ثابتًا
    (يتكرر نفسه في كل طباعة، ولا يبقى على ترتيبه الصحيح) */
export function shuffledOrder(q) {
  const items = (q.options?.items ?? []).map((text, i) => ({ text, i }));
  if (items.length < 2) return items;
  const out = shuffle(items, q._seed ?? q.id);
  // لا تُطبع مرتّبة أصلًا
  if (out.every((x, k) => x.i === k)) out.push(out.shift());
  return out;
}

/** خلط ثابت: البذرة نفسها تعطي الترتيب نفسه في كل طباعة */
function shuffle(list, seedText) {
  let seed = [...String(seedText ?? "")].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const out = [...list];
  for (let k = out.length - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1));
    [out[k], out[j]] = [out[j], out[k]];
  }
  return out;
}

/** خلط يختلف عن الأصل حتمًا (إن أمكن) — حتى لا يتطابق النموذجان صدفة */
function shuffleDiff(list, seedText) {
  const out = shuffle(list, seedText);
  if (out.length > 1 && out.every((x, k) => x === list[k])) out.push(out.shift());
  return out;
}

/**
 * النموذج (ب): نفس الأسئلة بترتيب مختلف —
 * تُخلط فقرات كل سؤال، وخيارات الاختيار من متعدد، وعمود المزاوجة الثاني،
 * وعناصر «رتّب»، مع إعادة ربط الإجابات الصحيحة. النموذج (أ) هو الأصل.
 */
export function variantFor(questions = [], model) {
  if (model !== "B") return questions;
  const qs = questions.map((q) => {
    const seed = `${q.id}:B`;
    const a = typeof q.answer === "string" ? q.answer.replace(/^"|"$/g, "") : q.answer;
    if (q.kind === "mcq" && Array.isArray(q.options) && q.options.length > 1) {
      const idx = shuffleDiff(q.options.map((_, i) => i), seed);
      return { ...q, options: idx.map((i) => q.options[i]), answer: String(idx.indexOf(Number(a))) };
    }
    if (q.kind === "match" && Array.isArray(q.options?.right) && q.options.right.length > 1) {
      const idx = shuffleDiff(q.options.right.map((_, i) => i), seed);
      const map = (a && typeof a === "object") ? a : {};
      const next = Object.fromEntries(Object.entries(map).map(([l, r]) => [l, String(idx.indexOf(Number(r)))]));
      return { ...q, options: { ...q.options, right: idx.map((i) => q.options.right[i]) }, answer: next };
    }
    if (q.kind === "order") return { ...q, _seed: seed };
    return q;
  });
  // فقرات كل سؤال بترتيب آخر (المجموعات نفسها تبقى بترتيب الأنماط)
  return PAPER_ORDER.flatMap((kind) => shuffleDiff(qs.filter((q) => q.kind === kind), `${kind}:B`));
}

export const MODEL_LABEL = { A: "أ", B: "ب" };

/** نص الإجابة النموذجية لفقرة (لنموذج الإجابة) */
export function modelAnswer(q, ltr = false) {
  const L = ltr ? ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"] : ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح", "ط", "ي", "ك", "ل", "م", "ن"];
  const a = typeof q.answer === "string" ? q.answer.replace(/^"|"$/g, "") : q.answer;
  switch (q.kind) {
    case "mcq": return L[Number(a)] ?? "";
    case "truefalse": return a === "false" ? (ltr ? "False" : "خطأ") : (ltr ? "True" : "صح");
    default: return typeof a === "string" ? a : (a?.text ?? "");
  }
}

/** خيارات الورقة المحفوظة مع الاختبار */
export const PAPER_OPTS = { compact: false, marksTable: true, models: false };
export const paperOpts = (quiz) => ({ ...PAPER_OPTS, ...(quiz?.paper_opts ?? {}) });
