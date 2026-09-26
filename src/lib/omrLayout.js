// src/lib/omrLayout.js
/* =====================================================================
   هندسة بطاقة الإجابة — مصدر واحد للحقيقة.
   الورقة المطبوعة ترسم البطاقة من هذه الأرقام (بالمليمتر)، وقارئ الكاميرا
   يستعمل الأرقام نفسها ليعرف موضع كل دائرة بدقة بعد تصحيح المنظور.
   أي تعديل في شكل البطاقة يكون هنا فقط، فيبقى الطباعة والقراءة متطابقين.
   ===================================================================== */

export const CARD = {
  W: 192,        // عرض البطاقة (عرض منطقة الطباعة في ورقة A4 بهوامش 9 مم)
  PAD: 3,        // فراغ أبيض بين الإطار والعلامات المرجعية
  MARK: 8,       // ضلع العلامة المرجعية السوداء
  GRID_TOP: 22,  // بداية شبكة الدوائر من أعلى البطاقة
  SIDE: 3,       // هامش الشبكة الأفقي داخل الإطار
};

// ترتيب الأسئلة في الورقة: مجموعات بحسب النوع، كما تعرضها QuizPaper
export const KIND_ORDER = ["mcq", "truefalse", "match"];

export function groupQuestions(questions = []) {
  const groups = [];
  KIND_ORDER.forEach((kind) => {
    const list = questions.filter((q) => q.kind === kind);
    if (list.length) groups.push({ kind, list });
  });
  return groups;
}

/* صفوف البطاقة: صف لكل فقرة، ولكل عنصر من عناصر المزاوجة صف مستقل.
   كل صف يحمل ما يلزم لتحويل الدائرة المظلَّلة إلى إجابة محفوظة. */
export function cardRows(questions = [], { qShort = "س", fShort = "ف" } = {}) {
  const rows = [];
  groupQuestions(questions).forEach((g, gi) => {
    g.list.forEach((q, qi) => {
      if (q.kind === "match") {
        const n = (q.options?.right ?? []).length || 4;
        (q.options?.left ?? []).forEach((_, k) => {
          rows.push({ key: `${q.id}-${k}`, qid: q.id, kind: "match", sub: k,
                      label: `${qShort}${gi + 1}: ${fShort}${k + 1}`, count: n });
        });
      } else {
        rows.push({
          key: q.id, qid: q.id, kind: q.kind, sub: null,
          label: `${qShort}${gi + 1}: ${fShort}${qi + 1}`,
          count: q.kind === "truefalse" ? 2 : (q.options?.length ?? 4),
        });
      }
    });
  });
  return rows;
}

/* التخطيط الكامل بالمليمتر. الإحداثيات فيزيائية (x من يسار البطاقة، y من
   أعلاها) بغضّ النظر عن اتجاه اللغة، حتى تطابق الصورة الملتقطة مباشرة. */
export function cardLayout(questions = [], { ltr = false, labels } = {}) {
  const rows = cardRows(questions, labels);
  const { W, PAD, MARK, GRID_TOP, SIDE } = CARD;

  const dense = rows.length > 15;               // الاختبارات الطويلة: ٤ أعمدة ودوائر أصغر
  const nCols = dense ? 4 : 3;
  const D = dense ? 5 : 6;                      // قطر الدائرة
  const STEP = dense ? 6.2 : 7.6;               // المسافة بين مراكز الدوائر
  const PITCH = dense ? 6.6 : 8;                // المسافة بين الصفوف
  const LBL = dense ? 11.5 : 13;                // عرض خانة رقم الفقرة
  const perCol = Math.max(1, Math.ceil(rows.length / nCols));
  const colW = (W - 2 * SIDE) / nCols;

  const gridBottom = GRID_TOP + PITCH * perCol;
  const H = gridBottom + 2 + MARK + PAD;        // فراغ ثم صف العلامات السفلية

  const m = PAD + MARK / 2;                     // مركز العلامة من الحافة
  const marks = { tl: { x: m, y: m }, tr: { x: W - m, y: m },
                  bl: { x: m, y: H - m }, br: { x: W - m, y: H - m } };

  const placed = rows.map((r, i) => {
    const col = Math.floor(i / perCol), row = i % perCol;
    const cy = GRID_TOP + PITCH * (row + 0.5);
    // العربية: العمود الأول يمينًا، ورقم الفقرة يمين الدوائر، و«أ» الأقرب إليه
    const colLeft = ltr ? SIDE + col * colW : W - SIDE - (col + 1) * colW;
    const colRight = colLeft + colW;
    const bubbles = Array.from({ length: r.count }, (_, k) => ({
      x: ltr ? colLeft + LBL + 1.5 + D / 2 + k * STEP
             : colRight - LBL - 1.5 - D / 2 - k * STEP,
      y: cy,
    }));
    const labelX = ltr ? colLeft : colRight - LBL;
    return { ...r, cy, bubbles, labelX, labelW: LBL };
  });

  return { W, H, D, dense, nCols, marks, markSize: MARK, rows: placed, gridTop: GRID_TOP, gridBottom };
}

/* تحويل ما قُرئ (فهرس الدائرة المظلَّلة لكل صف) إلى صيغة الإجابات المحفوظة:
   اختيار من متعدد "k"، صح/خطأ "true"/"false"، المزاوجة { "رقم العنصر": "k" } */
export function rowsToAnswers(rows, picks) {
  const answers = {};
  rows.forEach((r) => {
    const k = picks[r.key];
    if (k == null) return;
    if (r.kind === "mcq") answers[r.qid] = String(k);
    else if (r.kind === "truefalse") answers[r.qid] = k === 0 ? "true" : "false";
    else if (r.kind === "match") {
      answers[r.qid] = { ...(answers[r.qid] ?? {}), [String(r.sub)]: String(k) };
    }
  });
  return answers;
}

/* العكس: إجابات محفوظة → فهرس الدائرة لكل صف (لعرض القراءة السابقة) */
export function answersToPicks(rows, answers = {}) {
  const picks = {};
  rows.forEach((r) => {
    const a = answers[r.qid];
    if (a == null) return;
    if (r.kind === "mcq") picks[r.key] = Number(a);
    else if (r.kind === "truefalse") picks[r.key] = a === "true" ? 0 : a === "false" ? 1 : null;
    else if (r.kind === "match" && a[String(r.sub)] != null) picks[r.key] = Number(a[String(r.sub)]);
  });
  return picks;
}
