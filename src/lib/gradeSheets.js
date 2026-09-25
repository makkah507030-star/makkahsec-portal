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

/**
 * توزيع الصف الثاني — نسخة مستقلة عن الأول
 * (بعض المواد تتطابق أرقامها مع الأول، لكنها تُدار بإعداد خاص بالصف)
 */
export const GRADE_CONFIGS_G2 = {
  "الرياضيات": {
    periodGroups: [
      { label: "اختبارات قصيرة", cols: [{ label: "تقويمات تحريرية", max: 20 }] },
      { label: "تقييم مستمر", cols: [MHAM] },
    ],
  },
  "الفيزياء": {
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
  "الأحياء": {
    periodGroups: [
      { label: "تقييم مستمر", cols: [
        { label: "تقويمات تحريرية وتطبيقات عملية", max: 20 },
        MHAM,
      ]},
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
  "التاريخ": {
    periodGroups: [
      { label: "اختبارات قصيرة", cols: [{ label: "تقويمات تحريرية", max: 60 }] },
      { label: "تقييم مستمر", cols: [MHAM] },
    ],
  },
};

/**
 * توزيع الصف الثالث — نسخة مستقلة عن الأول والثاني
 */
export const GRADE_CONFIGS_G3 = {
  "الرياضيات": {
    periodGroups: [
      { label: "اختبارات قصيرة", cols: [{ label: "تقويمات تحريرية", max: 20 }] },
      { label: "تقييم مستمر", cols: [MHAM] },
    ],
  },
  "الفيزياء": {
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
  "علوم الأرض والفضاء": {
    periodGroups: [
      { label: "تقييم مستمر", cols: [
        { label: "تقويمات تحريرية وتطبيقات عملية", max: 20 },
        MHAM,
      ]},
    ],
  },

  // الاسم كما يظهر في الجدول الدراسي للمدرسة
  "علم الأرض": {
    periodGroups: [
      { label: "تقييم مستمر", cols: [
        { label: "تقويمات تحريرية وتطبيقات عملية", max: 20 },
        MHAM,
      ]},
    ],
  },
  "اللغة الإنجليزية": {
    periodGroups: [
      { label: "اختبارات قصيرة", cols: [{ label: "تقويمات شفهية وتحريرية", max: 20 }] },
      { label: "تقييم مستمر", cols: [MHAM] },
    ],
  },
  "البحث ومصادر التعلم": {
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
/**
 * توزيع مادة النشاط — بنية مختلفة جذريًا عن باقي المواد:
 * عمودان فقط بدرجة (50) لكل منهما، بلا مجموعات فرعية (اختبارات/تقييم مستمر).
 */
export const ACTIVITY_CONFIG = {
  periodGroups: [
    { label: null, cols: [
      { label: "مهام أدائية", max: 50 },
      { label: "مشاركة وتفاعل", max: 50 },
    ]},
  ],
};

export const DEFAULT_CONFIG = {
  periodGroups: [
    { label: "اختبارات قصيرة", cols: [{ label: "تقويمات تحريرية", max: 20 }] },
    { label: "تقييم مستمر", cols: [MHAM] },
  ],
};

const clean = (t) =>
  String(t).replace(/\s+/g, " ").replace(/[أإآ]/g, "ا").trim();

/**
 * مرادفات أسماء المواد: الاسم كما يرد في الجدول الدراسي ← الاسم المعرَّف هنا.
 * تُضاف هنا أي تسمية مختصرة أو مختلفة تظهر في جدول المدرسة.
 */
const ALIASES = {
  "علم الارض": "علوم الأرض والفضاء",
  "علوم الارض": "علوم الأرض والفضاء",
  "الارض والفضاء": "علوم الأرض والفضاء",
  "احياء": "الأحياء",
  "كيمياء": "الكيمياء",
  "فيزياء": "الفيزياء",
  "رياضيات": "الرياضيات",
  "انجليزي": "اللغة الإنجليزية",
  "اللغة الانجليزية": "اللغة الإنجليزية",
  "تاريخ": "التاريخ",
  "قران": "القرآن الكريم وتفسيره",
  "القران الكريم": "القرآن الكريم وتفسيره",
  "بدنية": "التربية الصحية والبدنية",
  "التربية البدنية": "التربية الصحية والبدنية",
  "حاسب": "التقنية الرقمية",
  "الحاسب الالي": "التقنية الرقمية",
  "مصادر التعلم": "البحث ومصادر التعلم",
  "البحث ومصادر المعلومات": "البحث ومصادر التعلم",
  "كفايات": "الكفايات اللغوية",
  "لغتي": "الكفايات اللغوية",
};

const resolveAlias = (name) => ALIASES[clean(name)] ?? name;

/** يبحث عن مادة داخل مجموعة إعدادات معيّنة (تطابق تام ثم جزئي) */
function lookup(subjectName, table) {
  const target = clean(resolveAlias(subjectName));
  for (const [k, v] of Object.entries(table)) {
    if (clean(k) === target) return v;
  }
  for (const [k, v] of Object.entries(table)) {
    const ck = clean(k);
    if (target.includes(ck) || ck.includes(target)) return v;
  }
  return null;
}

/** خريطة الصف → مجموعة إعداداته الخاصة */
const GRADE_TABLES = {
  1: GRADE_CONFIGS,     // الأول الثانوي
  2: GRADE_CONFIGS_G2,  // الثاني الثانوي
  3: GRADE_CONFIGS_G3,  // الثالث الثانوي
};

/**
 * مطابقة اسم المادة مع توزيعها — حسب الصف إن حُدّد، وإلا يبحث في توزيع
 * الصف الأول للتوافق مع الاستدعاءات القديمة.
 */
export function configFor(subjectName, grade) {
  if (!subjectName) return DEFAULT_CONFIG;

  // النشاط له توزيع ثابت واحد لكل الصفوف
  if (clean(subjectName) === "النشاط") return ACTIVITY_CONFIG;

  const table = GRADE_TABLES[grade] ?? GRADE_CONFIGS;
  return lookup(subjectName, table) ?? DEFAULT_CONFIG;
}

/** هل المادة معرّفة في نور لهذا الصف؟ (لتنبيه المستخدم) */
export function isKnownSubject(subjectName, grade) {
  return configFor(subjectName, grade) !== DEFAULT_CONFIG;
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
