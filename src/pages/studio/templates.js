// src/pages/studio/templates.js
import { hijriToday, GRADE_OPTIONS, TRACK_LABEL, classCode, classShort, iconFor, signIconFor } from "./lib";
import { loadSchedule, loadStudents, loadStaff, shortName } from "./data";
import { DAY_NAMES, GRADE_NAMES } from "../../lib/schoolTime";

/* =====================================================================
   قوالب استوديو البوابة: القسم الذي يظهر فيه كل قالب، وحقوله، وتعبئته
   التلقائية من حساب المستخدم (ctx). التصميم ثابت في Sheets.jsx، وما يغيّره
   المستخدم هنا فقط — فتبقى الهوية محفوظة مهما كُتب.
   ===================================================================== */

export const SECTIONS = [
  { key: "teacher", label: "المعلمين" },
  { key: "admin", label: "الإداريين" },
  { key: "student", label: "للطالب" },
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
      ? { icon: iconFor(c.roleTitle) ?? "building", place: c.roleTitle ? `مكتب ${c.roleTitle}` : "",
          name: c.name ? `أ. ${c.name}` : "", role: c.roleTitle, hours: "", room: "" }
      : { icon: "hall", place: c.subject ? `قاعة ${c.subject}` : "", name: c.name ? `أ. ${c.name}` : "",
          role: c.subject ? `معلم ${c.subject}` : "", hours: "", room: "" },
    /* الرمز يتبع اسم المكان أو الصفة عند كتابتهما، ويبقى تغييره يدويًا ممكنًا */
    derive: (d, name) => {
      if (name !== "place" && name !== "role") return d;
      // النصان معًا، فيغلب الأخص منهما («مكتب» + «رائد النشاط» ← نشاط)
      const icon = iconFor(d.place, d.role);
      return icon ? { ...d, icon } : d;
    },
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
      // الفصل نفسه، وإلا أول فصل في الصف — فالمسار يتبع الصف عادةً
      const inGrade = c.classList?.filter((x) => x.grade === g) ?? [];
      const k = inGrade.find((x) => classShort(x.class_no) === classShort(d.classNo)) ?? inGrade[0];
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
  /* ============================ المرحلة الثالثة ============================ */
  {
    key: "timetable",
    sections: ["admin", "teacher"],
    sheet: "timetable",
    fixedOrient: "landscape",
    batch: true,
    title: "جدول الحصص",
    desc: "جدول الفصل أو المعلم من جدول البوابة بأوقات الحصص والفسح — ويُطبع لكل الفصول أو المعلمين دفعة واحدة.",
    load: loadSchedule,
    fields: [
      { name: "mode", label: "النوع", type: "choice", options: ["جدول فصل", "جدول معلم"] },
      { name: "target", label: "الفصل أو المعلم", type: "select", options: (d, c) => ttTargets(d, c) },
      { name: "note", label: "ملاحظة أسفل الجدول (اختياري)", max: 80 },
      { name: "scope", label: "الطباعة", type: "opts",
        options: (d, c) => [["one", "هذا الجدول فقط"],
          ["all", d.mode === "جدول معلم" ? `كل المعلمين (${c.teachers?.length ?? 0})` : `كل الفصول (${ttClasses(c).length})`]] },
    ],
    defaults: (c, section) => ({
      mode: section === "teacher" ? "جدول معلم" : "جدول فصل", target: section === "teacher" ? (c.teacherId ?? "") : "",
      note: "", scope: "one", year: c.year, term: c.term,
    }),
    derive: (d, name) => (name === "mode" ? { ...d, target: "" } : d),
    sample: { heading: "جدول حصص الفصل 101", sub: "الأول الثانوي · السنة الأولى المشتركة", sampleGrid: true },
    view: (d, c) => ttBuild(d, c, d.target || ttTargets(d, c)[0]?.[0]),
    pages: (d, c) => (d.scope === "all" ? ttTargets(d, c).map(([v]) => ttBuild(d, c, v)) : [ttBuild(d, c, d.target || ttTargets(d, c)[0]?.[0])]),
  },
  {
    key: "seats",
    sections: ["admin"],
    sheet: "seats",
    batch: true,
    title: "ملصقات أرقام الجلوس",
    desc: "ملصق لكل طالب برقم جلوسه ولجنته وفصله، من كشوف البوابة — 14 ملصقًا في الورقة تُقصّ.",
    load: loadStudents,
    presets: { title: ["اختبارات نهاية الفصل الدراسي الأول", "اختبارات نهاية الفصل الدراسي الثاني", "اختبارات نهاية الفصل الدراسي الثالث", "اختبارات منتصف الفصل"] },
    fields: [
      { name: "title", label: "عنوان الاختبارات", max: 50 },
      { name: "scope", label: "الطلاب", type: "select", options: (d, c) => seatScopes(c) },
      { name: "order", label: "الترتيب", type: "opts", options: () => [["class", "بالفصل ثم الاسم"], ["name", "بالاسم"]] },
      { name: "start", label: "أول رقم جلوس", max: 6, dir: "ltr" },
      { name: "per", label: "عدد الطلاب في اللجنة", max: 3, dir: "ltr" },
    ],
    defaults: () => ({ title: "اختبارات نهاية الفصل الدراسي الأول", scope: "all", order: "class", start: "1001", per: "20", year: "" }),
    sample: { labels: Array.from({ length: 14 }, (_, i) => ({ seat: String(1001 + i), name: "اسم الطالب الرباعي", cls: "101", com: 1 + Math.floor(i / 20) })) },
    view: (d, c) => seatPages(d, c)[0] ?? { ...d, labels: [] },
    pages: (d, c) => { const p = seatPages(d, c); return p.length ? p : [{ ...d, labels: [] }]; },
  },
  {
    key: "sign",
    sections: ["admin", "teacher"],
    sheet: "sign",
    orients: true,
    defaultOrient: "landscape",
    title: "لافتة إرشادية",
    desc: "لافتات الاتجاهات والتعليمات بسهم ورمز: دورات المياه، المصلى، نقطة التجمع، ممنوع الدخول…",
    presets: {
      title: ["دورات المياه", "المصلى", "مخرج الطوارئ", "نقطة التجمع", "ممنوع الدخول", "الهدوء من فضلك",
              "الإدارة", "المقصف", "الدرج", "المصعد", "برادة الماء", "الاستقبال"],
    },
    fields: [
      { name: "title", label: "النص الرئيسي", max: 30 },
      { name: "sub", label: "سطر إضافي (اختياري)", max: 60 },
      { name: "icon", label: "الرمز", type: "icon", options: ["wc", "mosque", "exit", "assembly", "noentry", "quiet", "food", "stairs", "elevator", "water", "info", "building"] },
      { name: "arrow", label: "السهم", type: "opts", options: () => [["", "بلا"], ["right", "→ يمين"], ["left", "← يسار"], ["up", "↑ أمام"], ["down", "↓ أسفل"]] },
      { name: "tone", label: "الطابع", type: "opts", options: () => [["", "إرشادي"], ["warn", "تنبيه"]] },
    ],
    defaults: () => ({ title: "دورات المياه", sub: "", icon: "wc", arrow: "left", tone: "" }),
    derive: (d, name) => {
      if (name !== "title") return d;
      const icon = signIconFor(d.title);
      return { ...d, ...(icon ? { icon } : {}), tone: /ممنوع|تحذير|خطر|انتبه/.test(d.title) ? "warn" : "" };
    },
  },
  {
    key: "badge",
    sections: ["admin", "teacher"],
    sheet: "badge",
    batch: true,
    title: "بطاقة تعريف",
    desc: "بطاقة تعليق بالاسم والصفة وصورة اختيارية (5.4 × 8.6 سم) — 9 بطاقات في الورقة، ولكل المعلمين دفعة واحدة.",
    load: loadStaff,
    fields: [
      { name: "name", label: "الاسم", max: 40 },
      { name: "role", label: "الصفة", max: 36 },
      { name: "dept", label: "القسم أو المادة (اختياري)", max: 36 },
      { name: "photo", label: "الصورة (اختيارية)", type: "photo" },
      { name: "scope", label: "الطباعة", type: "opts",
        options: (d, c) => [["one", "بطاقة واحدة"], ["page", "ورقة كاملة (9 نسخ)"], ["staff", `كل المعلمين (${c.staff?.length ?? 0})`]] },
    ],
    defaults: (c, section) => ({
      name: c.name ? `أ. ${c.name}` : "", role: section === "admin" ? (c.roleTitle || "إداري") : "معلم",
      dept: section === "admin" ? c.dept : c.subject, photo: "", scope: "one", year: c.year,
    }),
    view: (d) => ({ ...d, cards: badgeCards(d, {})[0] }),
    pages: (d, c) => badgeCards(d, c).map((cards) => ({ ...d, cards })),
  },
  /* ============================ المناسبات والطالب ============================ */
  {
    key: "rollup",
    sections: ["admin", "teacher"],
    sheet: "rollup",
    title: "رول أب للمناسبات",
    desc: "لافتة واقفة بالمقاس المعتمد (85 × 200 سم وغيره) لبداية العام واليوم الوطني ويوم المعلم وأي مناسبة، بشعار المناسبة.",
    printSize: (d) => ROLLUP_SIZES[d.size] ?? ROLLUP_SIZES["85x200"],
    exportRatio: 100 / 25.4,            // 1 بكسل = 1 مم، فالصورة 100 نقطة/بوصة
    presets: {
      occasion: ["بداية العام الدراسي", "اليوم الوطني السعودي", "يوم التأسيس", "يوم المعلم العالمي",
                 "اليوم العالمي للغة العربية", "الحفل الختامي", "حفل التخرج", "أسبوع النشاط"],
      tagline: ["أهلًا وسهلًا بكم", "معًا نصنع المستقبل", "كل عام وأنتم بخير", "شكرًا معلمي"],
    },
    fields: [
      { name: "size", label: "المقاس", type: "opts", options: () => Object.entries(ROLLUP_SIZES).map(([k, v]) => [k, v.label]) },
      { name: "occasion", label: "المناسبة", max: 40 },
      { name: "tagline", label: "العبارة", max: 50 },
      { name: "logo", label: "شعار المناسبة (اختياري — PNG بخلفية شفافة أفضل)", type: "logo" },
      { name: "date", label: "التاريخ أو الموعد (اختياري)", max: 40 },
      { name: "sub", label: "سطر إضافي (اختياري)", type: "textarea", rows: 2, max: 120 },
    ],
    defaults: (c) => ({ size: "85x200", occasion: "بداية العام الدراسي", tagline: "أهلًا وسهلًا بكم", logo: "", date: c.year, sub: "" }),
  },
  {
    key: "thanks",
    sections: ["student"],
    sheet: "thanks",
    fixedOrient: "landscape",
    batch: true,
    title: "بطاقة شكر للطالب",
    desc: "شكر أو تهنئة أو تحفيز لطالب أو مجموعة أو فصل كامل — بالاسم والصف والفصل، وبطاقة لكل طالب عند الحاجة.",
    load: loadStudents,
    presets: {
      reason: ["لتميّزه الدراسي وتفوّقه", "لانضباطه والتزامه بالحضور", "لمشاركته المتميّزة في الإذاعة المدرسية",
               "لأخلاقه الرفيعة وتعاونه مع زملائه", "لتحسّن مستواه واجتهاده"],
    },
    fields: [
      { name: "kind", label: "النوع", type: "choice", options: ["شكر وتقدير", "تهنئة", "تحفيز", "تميّز"] },
      { name: "mode", label: "لمن؟", type: "opts", options: () => RECIPIENT_MODES },
      { name: "people", label: "الطلاب", type: "students" },
      { name: "reason", label: "العبارة", type: "textarea", rows: 2, max: 140 },
      { name: "signer", label: "الموقّع (الاسم)", max: 50 },
      { name: "signerTitle", label: "الموقّع (الصفة)", max: 50 },
      { name: "date", label: "التاريخ", max: 20 },
    ],
    defaults: (c, section) => ({
      kind: "شكر وتقدير", mode: "one", people: [], cls: "", reason: "لتميّزه الدراسي وتفوّقه",
      signer: c.name ? `أ. ${c.name}` : "", signerTitle: c.roleTitle || (c.subject ? `معلم ${c.subject}` : "المعلم"),
      date: hijriToday(), year: c.year,
    }),
    sample: { people: [{ name: "عبدالله محمد سعيد الغامدي", grade: 1, cls: "103" }] },
    view: (d) => studentPages(d)[0],
    pages: (d) => studentPages(d),
  },
  {
    key: "notice",
    sections: ["student"],
    sheet: "notice",
    batch: true,
    title: "إعلان للطلاب",
    desc: "إعلان أو تنبيه موجّه لطالب أو مجموعة أو فصل كامل — A4 بالاسم والفصل، ونسخة لكل طالب عند الحاجة.",
    load: loadStudents,
    fields: [
      { name: "kind", label: "النوع", type: "choice", options: ["إعلان", "تنبيه", "دعوة", "تذكير"] },
      { name: "mode", label: "لمن؟", type: "opts", options: () => RECIPIENT_MODES },
      { name: "people", label: "الطلاب", type: "students" },
      { name: "title", label: "الموضوع", max: 60 },
      { name: "body", label: "النص — كل سطر فقرة", type: "textarea", rows: 5, max: 700 },
      { name: "points", label: "نقاط (اختياري)", type: "list", rows: 4, max: 90 },
      { name: "signer", label: "الموقّع (الاسم)", max: 50 },
      { name: "signerTitle", label: "الموقّع (الصفة)", max: 50 },
      { name: "date", label: "التاريخ", max: 20 },
    ],
    defaults: (c) => ({
      kind: "إعلان", mode: "class", people: [], cls: "", title: "", body: "", points: [],
      signer: c.name ? `أ. ${c.name}` : "", signerTitle: c.roleTitle || (c.subject ? `معلم ${c.subject}` : "المعلم"),
      date: hijriToday(), year: c.year,
    }),
    sample: { cls: "101", title: "موعد الاختبار القصير", body: "نذكّركم بموعد الاختبار القصير يوم الأحد القادم في الحصة الثالثة.",
      points: ["إحضار الآلة الحاسبة", "مراجعة الوحدة الثانية"] },
    view: (d) => studentPages(d)[0],
    pages: (d) => studentPages(d),
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
  if (tpl.sheet === "rollup") return ROLLUP_SIZES[data?.size] ?? ROLLUP_SIZES["85x200"];
  const o = tpl.fixedOrient ?? (tpl.orients ? orient : "portrait");
  return o === "landscape" ? { w: 1123, h: 794 } : { w: 794, h: 1123 };
}

/* ----------------------------- جدول الحصص ----------------------------- */
const ttClasses = (c) => [...new Map((c.sched ?? []).filter((r) => r.classNo != null)
  .map((r) => [classCode(r.grade, r.classNo), r])).entries()]
  .sort((a, b) => Number(a[0]) - Number(b[0]));

function ttTargets(d, c) {
  if (d.mode === "جدول معلم") return (c.teachers ?? []).map((t) => [t.id, `أ. ${t.name}`]);
  return ttClasses(c).map(([code, r]) => [code, `${code} — ${GRADE_NAMES[r.grade] ?? ""}`]);
}

function ttBuild(d, c, target) {
  const byTeacher = d.mode === "جدول معلم";
  const rows = (c.sched ?? []).filter((r) => (byTeacher ? r.teacherId === target : classCode(r.grade, r.classNo) === target));
  const cells = {};
  rows.forEach((r) => {
    cells[`${r.day}-${r.period}`] = byTeacher
      ? { a: r.subject, b: `فصل ${classCode(r.grade, r.classNo)}` }
      : { a: r.subject, b: shortName(r.teacher) };
  });
  const first = rows[0];
  const t = byTeacher ? (c.teachers ?? []).find((x) => x.id === target) : null;
  const subjects = [...new Set(rows.map((r) => r.subject).filter(Boolean))];
  return {
    ...d, cells, cols: c.cols ?? [], days: Object.keys(DAY_NAMES).map(Number),
    heading: byTeacher ? `جدول حصص أ. ${t?.name ?? ""}` : `جدول حصص الفصل ${target ?? ""}`,
    sub: byTeacher ? `${subjects.join("، ")}${rows.length ? ` · ${rows.length} حصة` : ""}`
      : first ? [GRADE_NAMES[first.grade], TRACK_LABEL[(c.classList ?? []).find((k) => classCode(k.grade, k.class_no) === target)?.track]]
        .filter(Boolean).join(" · ") : "",
    count: rows.length,
  };
}

/* ----------------------------- أرقام الجلوس ----------------------------- */
function seatScopes(c) {
  const st = c.students ?? [];
  const grades = [...new Set(st.map((s) => s.grade))].sort();
  const classes = [...new Set(st.map((s) => classCode(s.grade, s.class_no)))].sort();
  return [["all", `كل الطلاب (${st.length})`],
    ...grades.map((g) => [`g${g}`, `${GRADE_NAMES[g] ?? g} (${st.filter((s) => s.grade === g).length})`]),
    ...classes.map((k) => [`c${k}`, `فصل ${k}`])];
}

function seatPages(d, c) {
  let st = (c.students ?? []).map((s) => ({ ...s, code: classCode(s.grade, s.class_no) }));
  if (d.scope?.startsWith("g")) st = st.filter((s) => `g${s.grade}` === d.scope);
  if (d.scope?.startsWith("c")) st = st.filter((s) => `c${s.code}` === d.scope);
  st.sort(d.order === "name"
    ? (a, b) => a.full_name.localeCompare(b.full_name, "ar")
    : (a, b) => Number(a.code) - Number(b.code) || a.full_name.localeCompare(b.full_name, "ar"));
  const start = parseInt(d.start, 10) || 1;
  const per = Math.max(1, parseInt(d.per, 10) || 20);
  const labels = st.map((s, i) => ({ seat: String(start + i), name: s.full_name, cls: s.code, com: Math.floor(i / per) + 1 }));
  const out = [];
  for (let i = 0; i < labels.length; i += 14) out.push({ ...d, labels: labels.slice(i, i + 14) });
  return out;
}

/* ----------------------------- بطاقات التعريف ----------------------------- */
function badgeCards(d, c) {
  const me = { name: d.name, role: d.role, dept: d.dept, photo: d.photo };
  if (d.scope === "page") return [Array.from({ length: 9 }, () => me)];
  if (d.scope === "staff" && c.staff?.length) {
    const all = c.staff.map((t) => ({ name: `أ. ${t.full_name}`, role: "معلم", dept: t.specialization ?? "" }));
    const out = [];
    for (let i = 0; i < all.length; i += 9) out.push(all.slice(i, i + 9));
    return out;
  }
  return [[me]];
}

/* ----------------------------- الرول أب ----------------------------- */
// المقاسات بالمليمتر؛ الورقة تُرسم 1 بكسل = 1 مم
export const ROLLUP_SIZES = {
  "85x200": { label: "85 × 200 سم (الأشيع)", w: 850, h: 2000 },
  "100x200": { label: "100 × 200 سم", w: 1000, h: 2000 },
  "120x200": { label: "120 × 200 سم", w: 1200, h: 2000 },
};

/* ----------------------------- مستندات الطالب ----------------------------- */
const RECIPIENT_MODES = [["one", "فردي (نسخة لكل طالب)"], ["group", "جماعي (نسخة بالأسماء)"], ["class", "الفصل كاملًا"]];

// نسخة لكل طالب في الوضع الفردي، ونسخة واحدة للمجموعة أو الفصل
function studentPages(d) {
  const people = d.people ?? [];
  if (d.mode === "one") return people.length ? people.map((p) => ({ ...d, to: [p] })) : [{ ...d, to: [] }];
  if (d.mode === "group") return [{ ...d, to: people }];
  return [{ ...d, to: [], toClass: d.cls }];
}
