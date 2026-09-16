/**
 * توزيع درجات المواد كما هو معتمد في نظام نور.
 *
 * بنية كل مادة:
 *   periodGroups: مجموعات أعمدة الفترة (أولى وثانية متطابقتان)
 *     label : عنوان المجموعة (اختبارات قصيرة / تقييم مستمر)
 *     cols  : الأعمدة تحتها، لكل عمود اسم ودرجة قصوى
 *
 * ملاحظة: عمود «نهاية الفترة (40)» غير مُدرج — يُرصد بطريقة أخرى.
 */

const MHAM = { label: "المهام الأدائية والمشاركة والتفاعل", max: 40 };

export const GRADE_CONFIGS = {
  "الرياضيات": {
    periodGroups: [
      { label: "اختبارات قصيرة", cols: [{ label: "تقويمات تحريرية", max: 20 }] },
      { label: "تقييم مستمر", cols: [MHAM] },
    ],
  },

  "اللغة الإنجليزية": {
    periodGroups: [
      { label: "اختبارات قصيرة", cols: [{ label: "تقويمات شفهية وتحريرية", max: 20 }] },
      { label: "تقييم مستمر", cols: [MHAM] },
    ],
  },

  "الكفايات اللغوية": {
    periodGroups: [
      { label: "اختبارات قصيرة", cols: [{ label: "تقويمات شفهية وتحريرية", max: 20 }] },
      { label: "تقييم مستمر", cols: [MHAM] },
    ],
  },

  "الأحياء": {
    periodGroups: [
      { label: "تقييم مستمر", cols: [
        { label: "تقويمات تحريرية وتطبيقات عملية", max: 20 },
        MHAM,
      ]},
    ],
  },

  "الكيمياء": {
    periodGroups: [
      { label: "تقييم مستمر", cols: [
        { label: "تقويمات تحريرية وتطبيقات عملية", max: 20 },
        MHAM,
      ]},
    ],
  },

  "القرآن الكريم وتفسيره": {
    periodGroups: [
      { label: "اختبارات قصيرة", cols: [{ label: "تقويمات شفهية وتحريرية", max: 60 }] },
      { label: "تقييم مستمر", cols: [MHAM] },
    ],
  },

  "التفكير الناقد": {
    periodGroups: [
      { label: "اختبارات قصيرة", cols: [{ label: "تقويمات تحريرية", max: 60 }] },
      { label: "تقييم مستمر", cols: [MHAM] },
    ],
  },

  "التربية الصحية والبدنية": {
    periodGroups: [
      { label: "تقييم مستمر", cols: [
        { label: "تقويمات تحريرية وأدوات تقويم متنوعة", max: 60 },
        MHAM,
      ]},
    ],
  },

  "التقنية الرقمية": {
    periodGroups: [
      { label: "تقييم مستمر", cols: [
        { label: "تقويمات تحريرية وتطبيقات عملية", max: 60 },
        MHAM,
      ]},
    ],
  },
};

/** التوزيع الافتراضي لمادة غير مُعرّفة */
export const DEFAULT_CONFIG = {
  periodGroups: [
    { label: "اختبارات قصيرة", cols: [{ label: "تقويمات تحريرية", max: 20 }] },
    { label: "تقييم مستمر", cols: [MHAM] },
  ],
};

/** مطابقة اسم المادة مع التوزيع (تتسامح مع اختلاف بسيط في الصياغة) */
export function configFor(subjectName) {
  if (!subjectName) return DEFAULT_CONFIG;

  const clean = (t) =>
    String(t).replace(/\s+/g, " ").replace(/[أإآ]/g, "ا").trim();

  const target = clean(subjectName);

  // مطابقة تامة
  for (const [k, v] of Object.entries(GRADE_CONFIGS)) {
    if (clean(k) === target) return v;
  }
  // مطابقة جزئية
  for (const [k, v] of Object.entries(GRADE_CONFIGS)) {
    const ck = clean(k);
    if (target.includes(ck) || ck.includes(target)) return v;
  }
  return DEFAULT_CONFIG;
}

/** هل المادة معرّفة في نور؟ (لتنبيه المستخدم) */
export function isKnownSubject(subjectName) {
  return configFor(subjectName) !== DEFAULT_CONFIG;
}

/**
 * يبني رأس جدول سجل الدرجات (صفّان فقط).
 * أُلغيت صفوف مجموعات «تقييم مستمر / اختبارات قصيرة»،
 * وأُلغي عمود «نهاية الفصل» بما فيه (لوجود إجراء آخر للاختبارات النهائية).
 */
export function buildGradeHeader(config) {
  const cols = config.periodGroups.flatMap((g) => g.cols);
  const perPeriod = cols.length + 1; // + مجموع الفترة

  const row1 = [
    { text: "م", rowspan: 2 },
    { text: "رقم الهوية", rowspan: 2 },
    { text: "اسم الطالب", rowspan: 2 },
    { text: "الفترة الأولى", colspan: perPeriod },
    { text: "الفترة الثانية", colspan: perPeriod },
    { text: "المجموع", rowspan: 2 },
  ];

  const periodCells = [
    ...cols.map((c) => ({ text: `${c.label} (${c.max})` })),
    { text: "مجموع الفترة" },
  ];

  const row2 = [...periodCells, ...periodCells.map((c) => ({ ...c }))];

  return {
    headerRows: [row1, row2],
    colCount: 3 + perPeriod * 2 + 1,
  };
}

/** عدد الخانات الفارغة لكل طالب */
export function gradeBlankCount(config) {
  const cols = config.periodGroups.flatMap((g) => g.cols).length;
  return (cols + 1) * 2 + 1; // فترتان (أعمدة + مجموع) + المجموع النهائي
}
