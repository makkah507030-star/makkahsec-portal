// src/lab-content/g10/u4-l3-html-form.js
// الأول الثانوي — التقنية الرقمية (1)، الوحدة الرابعة، الدرس الثالث: إنشاء نموذج بلغة HTML (ص188–201).
// مطابق لكتاب الوزارة 1448: مفهوم النموذج وكيفية عمله وبنيته، ووسوم input وfieldset، ومعه مصطلحات الوحدة.

const DOC = (body, title = "Examples") => `<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <title>${title}</title>
    <meta charset="UTF-8" />
  </head>
  <body>
${body}
  </body>
</html>`;

export default {
  id: "g10-u4-l3",
  grade: "الأول الثانوي",
  term: 1,
  unit: { no: 4, title: "البرمجة باستخدام لغة ترميز النص التشعبي" },
  lesson: { no: 3, title: "إنشاء نموذج بلغة HTML" },
  pages: "188–201",
  objectives: [
    "تعريف النموذج وشرح كيفية عمله.",
    "إنشاء نموذج بالوسم form وتحديد عنوان الخادم بالسمة action.",
    "استخدام أنواع الوسم input والتسميات label.",
    "تجميع حقول النموذج بالوسم fieldset وتسميتها بالوسم legend.",
  ],
  stations: [
    {
      id: "s1", type: "concept", title: "مفهوم النموذج",
      slides: [
        {
          title: "النموذج بلغة HTML",
          text: "تعلمت سابقًا كيفية إنشاء صفحة بلغة HTML باستخدام الوسوم الأساسية. وأثناء العمل على تصميم موقعك الإلكتروني، قد تحتاج إلى نموذج لإدخال البيانات. في هذا الدرس ستتعرف على كيفية إنشاء نموذج بلغة HTML.\n**النموذج** (Form) مستند يحتوي على حقول لإدخال البيانات. يتضمن كل حقل في النموذج على اسم محدد يُمكّن المستخدم الذي يتصفح النموذج من معرفة عناصره المختلفة.",
          figure: { type: "note", text: "النماذج الأكثر استخدامًا هي: نموذج مربع بحث جوجل (Google) ونموذج التسجيل على جوجل (Google)." },
        },
        {
          title: "كيفية عمل النموذج",
          text: "عندما ترى نموذجًا في موقع إلكتروني، ستلاحظ وجود مربعات الإدخال والخيارات وجميعها يُنفّذ بلغة HTML. عندما يملأ المستخدم النموذج ويضغط على زر الإرسال، يجري إرسال المعلومات إلى الخادم للمعالجة أو للحفظ.",
        },
        {
          title: "بنية النموذج",
          text: "يحتوي النموذج على عناصر تحكم متعددة، ويجمع كل منها معلومات مختلفة. توجد عناصر التحكم بالنماذج داخل وسم `<form>` ويتطلب كل وسم سمة مميزة. تستقبل السمة قيمة هي عنوان الارتباط التشعبي (**URL**) للصفحة الموجودة على الخادم التي تستقبل معلومات من النموذج عند إرسالها، على سبيل المثال: `<form action=\"http://www.myhttpserver.eu/comments.php\">`",
          figure: { type: "note", text: "هذا هو عنوان النموذج الذي ستستخدمه في الكتاب. لكي يعمل النموذج الخاص بك بشكل صحيح، تحتاج إلى استبدال هذا العنوان بآخر في الخادم المحلي الخاص بك." },
        },
      ],
      check: { kind: "mcq", q: "السمة التي تحدد عنوان الصفحة على الخادم التي تستقبل معلومات النموذج:", options: ["action", "href", "src", "type"], answer: 0 },
    },
    {
      id: "s2", type: "practice", widget: "sequence", title: "دورة عمل النموذج",
      intro: "رتّب خطوات عمل النموذج كما في مخطط الكتاب.",
      tasks: [
        { prompt: "رتّب الخطوات", items: ["تُرسل البيانات من النموذج إلى الخادم", "يستقبل الخادم البيانات من النموذج ويقوم بمعالجتها", "ينشئ الخادم صفحة استجابة جديدة تُرسل إلى المستخدم"] },
      ],
    },
    {
      id: "s3", type: "concept", title: "وسم input",
      slides: [
        {
          title: "أنواع الوسم input",
          text: "يُستخدم وسم `<input>` للتحكم بعناصر النموذج، والتي يمكن عرضها بطرق مختلفة اعتمادًا على نوع السمة.",
          figure: { type: "table", head: ["المسار", "الوصف"], rows: [
            ["<input type=\"text\">", "ينشئ سطرًا واحدًا مخصصًا من النص"],
            ["<input type=\"password\">", "ينشئ سطرًا واحدًا من النص مع إمكانية إخفاء النص واستخدامه مع كلمة المرور"],
            ["<input type=\"email\">", "ينشئ سطرًا واحدًا مخصصًا للبريد الإلكتروني مع ميزة التحقق من كتابة البريد الإلكتروني بشكل صحيح"],
            ["<input type=\"submit\">", "ينشئ زر الموافقة على الإرسال إلى الخادم"],
            ["<input type=\"radio\">", "يحدد زر الاختيار من متعدد ويمكن للمستخدم تحديد خيار واحد فقط"],
          ] },
        },
        {
          title: "أمثلة على الأنواع",
          text: "مثال: `<p>اسم المستخدم <input type=\"text\" name=\"username\"></p>` و`<p>كلمة المرور <input type=\"password\" name=\"password\"></p>`.\nيُستخدم الوسم `<label for=\"username\">` لكتابة تسمية للحقل. وتُستخدم سمة **القيمة** (value) لتحديد النص الذي سيظهر على زر الأمر: `<input type=\"submit\" value=\"إرسال\">`.",
          figure: { type: "note", text: "وسم <input> لا يحتوي على وسم إغلاق." },
        },
        {
          title: "وسم fieldset",
          text: "يُستخدم وسم `<fieldset>` لتجميع العناصر ذات الصلة في النموذج. ويُستخدم وسم `<legend>` لتسمية مجموعة حقول الإدخال، مثل: `<legend>اتصل بنا</legend>`.",
        },
      ],
      check: { kind: "mcq", q: "نوع الإدخال الذي يخفي النص المكتوب:", options: ["password", "text", "email", "submit"], answer: 0 },
    },
    {
      id: "s4", type: "practice", widget: "classify", title: "أي نوع؟",
      intro: "اختر نوع الوسم input المناسب لكل حقل.",
      tasks: [
        { prompt: "صنّف كل حقل", cats: ["text", "password", "email", "submit", "radio"],
          items: [["اسم المستخدم", 0], ["كلمة المرور", 1], ["البريد الإلكتروني مع التحقق من كتابته", 2], ["زر الإرسال إلى الخادم", 3], ["اختيار الجنس: خيار واحد فقط", 4]] },
      ],
    },
    {
      id: "s5", type: "practice", widget: "html", title: "صفحة «اتصل بنا»",
      intro: "اكتب الكود في المحرر، وشاهد النموذج بجانبه، ثم اضغط «تحقق».",
      tasks: [
        { prompt: "أنشئ نموذجًا يرسل إلى http://www.myhttpserver.eu/comments.php فيه حقل اسم المستخدم (text) وحقل كلمة المرور (password)",
          start: DOC("    "),
          checks: [["<form[^>]*action=\"http://www\\.myhttpserver\\.eu/comments\\.php\"", "ابدأ بالوسم <form> مع السمة action وعنوان الخادم"], ["<input[^>]*type=\"text\"[^>]*name=\"username\"", "أضف <input type=\"text\" name=\"username\">"], ["<input[^>]*type=\"password\"", "أضف حقل كلمة المرور <input type=\"password\">"], ["</form>", "أغلق النموذج بالوسم </form>"]],
          solution: DOC("    <form action=\"http://www.myhttpserver.eu/comments.php\">\n      <p>اسم المستخدم <input type=\"text\" name=\"username\"></p>\n      <p>كلمة المرور <input type=\"password\" name=\"password\"></p>\n    </form>") },
        { prompt: "نموذج «اتصل بنا»: اجمع الحقول في fieldset عنوانه legend «اتصل بنا»، وفيه حقل البريد الإلكتروني (email) وزر إرسال قيمته «إرسال»",
          start: DOC("    <form action=\"http://www.myhttpserver.eu/comments.php\">\n      <label for=\"username\">اسم المستخدم:</label>\n      <input type=\"text\" name=\"username\">\n    </form>", "Contact Us"),
          checks: [["<fieldset>[^]*</fieldset>", "اجمع الحقول بين <fieldset> و</fieldset>"], ["<legend>\\s*اتصل بنا\\s*</legend>", "سمِّ المجموعة بالوسم <legend>اتصل بنا</legend>"], ["<input[^>]*type=\"email\"", "أضف حقل <input type=\"email\">"], ["<input[^>]*type=\"submit\"[^>]*value=\"إرسال\"", "أضف زر <input type=\"submit\" value=\"إرسال\">"]],
          solution: DOC("    <form action=\"http://www.myhttpserver.eu/comments.php\">\n      <fieldset>\n        <legend>اتصل بنا</legend>\n        <label for=\"username\">اسم المستخدم:</label>\n        <input type=\"text\" name=\"username\">\n        <label for=\"email\">البريد الإلكتروني:</label>\n        <input type=\"email\" name=\"email\">\n        <input type=\"submit\" value=\"إرسال\">\n      </fieldset>\n    </form>", "Contact Us"),
          hint: ["ضع <legend> أول عنصر داخل <fieldset>.", "حقل البريد: <input type=\"email\" name=\"email\">"] },
      ],
    },
    {
      id: "s6", type: "quiz", title: "اختبار الدرس", pass: 70,
      questions: [
        { kind: "tf", q: "عند الضغط على زر الإرسال تُرسل معلومات النموذج إلى الخادم للمعالجة أو للحفظ.", answer: true },
        { kind: "tf", q: "وسم <input> يحتاج إلى وسم إغلاق.", answer: false },
        { kind: "mcq", q: "يتحقق من كتابة البريد الإلكتروني بشكل صحيح النوع:", options: ["email", "text", "password", "radio"], answer: 0 },
        { kind: "mcq", q: "الوسم الذي يجمع العناصر ذات الصلة في النموذج:", options: ["<fieldset>", "<legend>", "<label>", "<ul>"], answer: 0 },
        { kind: "mcq", q: "السمة التي تحدد النص الظاهر على زر الإرسال:", options: ["value", "name", "for", "action"], answer: 0 },
        { kind: "match", q: "صِل كل مصطلح بمقابله الإنجليزي:", pairs: [
          ["نموذج", "Form"],
          ["الخادم", "Server"],
          ["تسمية", "Label"],
          ["إرسال", "Submit"],
          ["النص التشعبي", "Hypertext"],
        ] },
      ],
    },
  ],
};
