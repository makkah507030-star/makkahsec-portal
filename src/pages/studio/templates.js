// src/pages/studio/templates.js

/* =====================================================================
   قوالب استوديو البوابة: القسم الذي يظهر فيه كل قالب، وحقوله، وتعبئته
   التلقائية من حساب المستخدم (ctx). التصميم ثابت في Sheets.jsx، وما يغيّره
   المستخدم هنا فقط — فتبقى الهوية محفوظة مهما كُتب.
   ===================================================================== */

export const SECTIONS = [
  { key: "teacher", label: "المعلمين" },
  { key: "admin", label: "الإداريين" },
];

export const TEMPLATES = [
  {
    key: "cover-teacher",
    sections: ["teacher"],
    sheet: "cover",
    kind: "teacher",
    title: "غلاف سجل",
    desc: "سجل الدرجات والتحضير والمتابعة وملف الإنجاز — طولي أو عرضي.",
    orients: true,
    presets: { title: ["سجل الدرجات", "سجل التحضير", "سجل المتابعة", "ملف الإنجاز", "الخطط الفصلية", "سجل الاختبارات"] },
    fields: [
      { name: "title", label: "عنوان السجل", max: 40 },
      { name: "sub", label: "العنوان الفرعي", max: 50 },
      { name: "teacher", label: "المعلم", max: 50 },
      { name: "subject", label: "المادة", max: 40 },
      { name: "classes", label: "الفصول", max: 60 },
      { name: "year", label: "العام الدراسي", max: 24 },
    ],
    defaults: (c) => ({
      title: "سجل الدرجات", sub: c.term, teacher: c.name ? `أ. ${c.name}` : "",
      subject: c.subject, classes: c.classes, year: c.year,
    }),
  },
  {
    key: "cover-admin",
    sections: ["admin"],
    sheet: "cover",
    kind: "admin",
    title: "غلاف سجل إداري",
    desc: "سجلات الأقسام الإدارية برقم مرجعي ومدة حفظ — طولي أو عرضي.",
    orients: true,
    presets: {
      title: ["سجل الاجتماعات", "سجل الزيارات", "سجل الوارد", "سجل الصادر", "سجل المناوبة", "سجل الحضور والانصراف"],
      retention: ["سنة واحدة", "3 سنوات", "5 سنوات", "دائم"],
    },
    fields: [
      { name: "title", label: "عنوان السجل", max: 40 },
      { name: "sub", label: "العنوان الفرعي", max: 50 },
      { name: "code", label: "رقم السجل", max: 12, dir: "ltr" },
      { name: "dept", label: "القسم", max: 40 },
      { name: "person", label: "المسؤول (الاسم)", max: 50 },
      { name: "personTitle", label: "المسؤول (الصفة)", max: 50 },
      { name: "retention", label: "مدة الحفظ", max: 24 },
      { name: "year", label: "العام الدراسي", max: 24 },
    ],
    defaults: (c) => ({
      title: "سجل الاجتماعات", sub: "", code: `${c.deptCode || "AD"}-01`, dept: c.dept,
      person: c.name ? `أ. ${c.name}` : "", personTitle: c.roleTitle, retention: "3 سنوات", year: c.year,
    }),
  },
  {
    key: "divider",
    sections: ["teacher", "admin"],
    sheet: "divider",
    title: "فاصل أقسام",
    desc: "يفصل أقسام الملف، بلسان فهرسة يتدرّج مكانه مع رقم القسم.",
    fields: [
      { name: "n", label: "رقم القسم", type: "number", min: 1, max: 10 },
      { name: "title", label: "عنوان القسم", max: 40 },
      { name: "desc", label: "وصف القسم (اختياري)", type: "textarea", max: 140 },
      { name: "recName", label: "اسم السجل", max: 30 },
      { name: "recSub", label: "المادة أو القسم", max: 30 },
      { name: "year", label: "العام الدراسي", max: 24 },
      { name: "toc", label: "محتويات القسم (اختياري)", type: "toc", rows: 5 },
    ],
    // بيانات عرض للمعرض فقط — المحرّر يبدأ بالتعبئة التلقائية
    sample: {
      n: 2, title: "الاختبارات القصيرة", desc: "نماذج الاختبارات القصيرة وكشوف رصد درجاتها.",
      toc: [{ a: "الاختبار القصير الأول", b: "الأسبوع 3" }, { a: "الاختبار القصير الثاني", b: "الأسبوع 6" }],
    },
    defaults: (c, section) => ({
      n: 1, title: "", desc: "", recName: section === "admin" ? "سجل الاجتماعات" : "سجل الدرجات",
      recSub: section === "admin" ? c.dept : c.subject, year: c.year, toc: [],
    }),
  },
  {
    key: "spines",
    sections: ["teacher", "admin"],
    sheet: "spines",
    title: "ملصق ظهر الملف",
    desc: "ملصقات موحّدة لظهور الملفات، تُطبع معًا على ورقة واحدة وتُقصّ.",
    fields: [
      { name: "size", label: "عرض الملصق", type: "size" },
      { name: "year", label: "العام الدراسي", max: 24 },
      { name: "items", label: "الملصقات", type: "spines" },
    ],
    sample: (c, section) => ({
      items: section === "admin"
        ? [
            { title: "سجل الاجتماعات", sub: c.dept, no: "1" }, { title: "سجل الزيارات", sub: c.dept, no: "2" },
            { title: "سجل الوارد", sub: c.dept, no: "3" }, { title: "سجل الصادر", sub: c.dept, no: "4" },
          ]
        : [
            { title: "سجل الدرجات", sub: c.subject, no: "1" }, { title: "سجل التحضير", sub: c.subject, no: "2" },
            { title: "ملف الإنجاز", sub: "", no: "3" }, { title: "الخطط الفصلية", sub: c.subject, no: "4" },
          ],
    }),
    defaults: (c, section) => ({
      size: "narrow", year: c.year,
      items: section === "admin"
        ? [{ title: "سجل الاجتماعات", sub: c.dept, no: "1" }]
        : [{ title: "سجل الدرجات", sub: c.subject, no: "1" }],
    }),
  },
];

export const templateOf = (key) => TEMPLATES.find((t) => t.key === key);
