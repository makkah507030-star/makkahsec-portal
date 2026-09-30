// src/pages/studio/templates.js
import { hijriToday, GRADE_OPTIONS, TRACK_LABEL, classCode, classShort } from "./lib";

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
    key: "circular",
    sections: ["admin"],
    sheet: "circular",
    title: "تعميم وإعلان",
    desc: "تعميم أو إعلان أو تنبيه أو دعوة على A4 — برقم وتاريخ وتوقيع، والرسمية بترويسة الوزارة.",
    presets: {
      to: ["جميع المعلمين", "جميع منسوبي المدرسة", "جميع الطلاب", "أولياء الأمور", "رواد الفصول"],
    },
    fields: [
      { name: "kind", label: "نوع الورقة", type: "choice", options: ["تعميم", "إعلان", "تنبيه", "دعوة"] },
      { name: "no", label: "الرقم", max: 14, dir: "ltr" },
      { name: "date", label: "التاريخ", max: 20 },
      { name: "to", label: "إلى", max: 50 },
      { name: "title", label: "الموضوع", max: 60 },
      { name: "body", label: "النص — كل سطر فقرة", type: "textarea", rows: 7, max: 1100 },
      { name: "points", label: "نقاط مرقّمة (اختياري)", type: "list", rows: 5, max: 100 },
      { name: "signer", label: "الموقّع (الاسم)", max: 50 },
      { name: "signerTitle", label: "الموقّع (الصفة)", max: 50 },
    ],
    sample: {
      title: "مواعيد اختبارات منتصف الفصل",
      body: "نفيدكم بأن اختبارات منتصف الفصل تبدأ يوم الأحد القادم وفق الجدول المعتمد في البوابة، ونأمل التعاون في تهيئة الطلاب ومتابعة حضورهم.",
      points: ["تسليم الأسئلة للشؤون التعليمية قبل الاختبار بثلاثة أيام", "رصد الدرجات في البوابة خلال أسبوع", "إشعار ولي أمر الطالب المتغيب"],
    },
    defaults: (c) => ({
      kind: "تعميم", no: `${c.deptCode || "AD"}-01`, date: hijriToday(), to: "جميع المعلمين",
      title: "", body: "", points: [],
      signer: c.name ? `أ. ${c.name}` : "", signerTitle: c.roleTitle, year: c.year,
    }),
  },
  {
    key: "door",
    sections: ["admin", "teacher"],
    sheet: "door",
    fixedOrient: "landscape",
    title: "لوحة باب",
    desc: "لوحة موحّدة لأبواب المكاتب والقاعات والمعامل — A4 بالعرض.",
    presets: {
      place: ["مكتب مدير المدرسة", "مكتب وكيل الشؤون التعليمية", "مكتب وكيل الشؤون المدرسية", "مكتب وكيل شؤون الطلاب",
              "مكتب الموجّه الطلابي", "مكتب رائد النشاط الطلابي", "مكتب المساعد الإداري", "غرفة المعلمين",
              "برنامج الموهوبين", "برنامج جلوب البيئي العالمي",
              "معمل الحاسب الآلي", "مختبر العلوم", "العيادة المدرسية", "مصادر التعلم",
              "قاعة الاجتماعات", "قاعة النشاط", "القاعة متعددة الأغراض"],
      hours: ["7:30 – 12:30", "بعد الحصة الثالثة", "طوال اليوم الدراسي"],
    },
    fields: [
      { name: "icon", label: "الرمز", type: "icon", options: ["building", "user", "hall", "cap", "book", "flask", "monitor", "health", "chat", "shield", "trophy", "star", "globe"] },
      { name: "place", label: "اسم المكتب أو القاعة", max: 40 },
      { name: "name", label: "الاسم (اختياري)", max: 50 },
      { name: "role", label: "الصفة (اختياري)", max: 50 },
      { name: "hours", label: "أوقات المراجعة (اختياري)", max: 40 },
      { name: "room", label: "رقم الغرفة (اختياري)", max: 6, dir: "ltr" },
    ],
    defaults: (c, section) => section === "admin"
      ? { icon: "building", place: c.roleTitle ? `مكتب ${c.roleTitle}` : "", name: c.name ? `أ. ${c.name}` : "",
          role: c.roleTitle, hours: "", room: "" }
      : { icon: "hall", place: c.subject ? `قاعة ${c.subject}` : "", name: c.name ? `أ. ${c.name}` : "",
          role: c.subject ? `معلم ${c.subject}` : "", hours: "", room: "" },
    sample: (c, section) => section === "admin"
      ? { hours: "7:30 – 12:30", room: "A-04" }
      : { room: "B-12" },
  },
  {
    key: "classdoor",
    sections: ["admin", "teacher"],
    sheet: "classdoor",
    fixedOrient: "landscape",
    batch: true,
    title: "لوحة فصل",
    desc: "لوحة باب الفصل برقمه وصفّه ومساره — وتُطبع لكل الفصول دفعة واحدة.",
    presets: {
      track: ["السنة الأولى المشتركة", "المسار العام", "مسار الصحة والحياة", "مسار علوم الحاسب والهندسة",
              "مسار إدارة الأعمال", "المسار الشرعي"],
      motto: ["فصلٌ متميّز", "هنا نصنع المستقبل", "نتعلّم لنرتقي"],
    },
    fields: [
      { name: "grade", label: "الصف", type: "choice", options: GRADE_OPTIONS },
      { name: "classNo", label: "رقم الفصل", type: "number", min: 1, max: 12,
        display: (n, d) => classCode(GRADE_OPTIONS.indexOf(d.grade) + 1, n) },
      { name: "track", label: "المسار (اختياري)", max: 40 },
      { name: "room", label: "رقم الغرفة (اختياري)", max: 6, dir: "ltr" },
      { name: "motto", label: "عبارة الفصل (اختياري)", max: 40 },
      { name: "batch", label: "الطباعة", type: "batch" },
    ],
    defaults: (c) => {
      const first = c.classList?.[0];
      return {
        grade: GRADE_OPTIONS[(first?.grade ?? 1) - 1] ?? GRADE_OPTIONS[0], classNo: classShort(first?.class_no ?? 1),
        track: TRACK_LABEL[first?.track] ?? "",
        room: "", motto: "", batch: "one", year: c.year,
      };
    },
    sample: { classNo: 3, room: "B-12" },
    /* عند تغيير الصف أو رقم الفصل يُؤخذ مساره من جدول الفصول إن وُجد */
    derive: (d, name, c) => {
      if (name !== "grade" && name !== "classNo") return d;
      const g = GRADE_OPTIONS.indexOf(d.grade) + 1;
      const k = c.classList?.find((x) => x.grade === g && classShort(x.class_no) === classShort(d.classNo));
      return k && TRACK_LABEL[k.track] ? { ...d, track: TRACK_LABEL[k.track] } : d;
    },
    /* صفحات الطباعة: هذا الفصل، أو كل فصول الصف، أو كل الفصول — من جدول الفصول */
    pages: (d, c) => {
      if (d.batch === "one" || !c.classList?.length) return [d];
      const g = GRADE_OPTIONS.indexOf(d.grade) + 1;
      return c.classList
        .filter((k) => d.batch === "all" || k.grade === g)
        .map((k) => ({
          ...d, grade: GRADE_OPTIONS[k.grade - 1] ?? d.grade, classNo: classShort(k.class_no),
          track: TRACK_LABEL[k.track] ?? d.track, room: "",
        }));
    },
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
  {
    key: "social",
    sections: ["admin", "teacher"],
    sheet: "social",
    defaultTheme: "dark",
    print: false,
    title: "منشور للتواصل",
    desc: "منشور مربع أو قصة (ستوري) بهوية الفيديو — للواتساب ووسائل التواصل، ويُنزَّل صورة.",
    presets: { tag: ["خبر", "إعلان", "تهنئة", "تذكير", "إنجاز", "فعالية"] },
    fields: [
      { name: "format", label: "المقاس", type: "format" },
      { name: "tag", label: "الشارة", max: 20 },
      { name: "title", label: "العنوان", max: 40 },
      { name: "accent", label: "السطر الملوّن", max: 40 },
      { name: "sub", label: "النص (اختياري)", type: "textarea", rows: 3, max: 170 },
      { name: "points", label: "نقاط (اختياري)", type: "list", rows: 4, max: 60 },
      { name: "date", label: "التاريخ أو الموعد (اختياري)", max: 34 },
    ],
    sample: {
      title: "اختبارات منتصف الفصل", accent: "تبدأ الأحد القادم",
      points: ["الجدول متاح في البوابة", "الحضور قبل الاختبار بعشر دقائق"],
    },
    defaults: () => ({
      format: "square", tag: "إعلان", title: "", accent: "", sub: "", points: [], date: hijriToday(),
    }),
  },
];

export const templateOf = (key) => TEMPLATES.find((t) => t.key === key);

// مقاس الورقة بالبكسل: A4 طولي أو عرضي، أو مقاس المنشور
export const SOCIAL_FORMATS = {
  square: { label: "مربع 1080×1080", w: 1080, h: 1080 },
  story:  { label: "قصة 1080×1920", w: 1080, h: 1920 },
};
export function sheetDims(tpl, orient, data) {
  if (tpl.sheet === "social") return SOCIAL_FORMATS[data?.format] ?? SOCIAL_FORMATS.square;
  const o = tpl.fixedOrient ?? (tpl.orients ? orient : "portrait");
  return o === "landscape" ? { w: 1123, h: 794 } : { w: 794, h: 1123 };
}
