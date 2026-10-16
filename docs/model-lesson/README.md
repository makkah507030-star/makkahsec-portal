# مشروع «الحصة النموذجية»

قالب PowerPoint لحصة نموذجية مدتها 50 دقيقة، صالح لكل المواد، بهوية البوابة. أُعدّ للزيارة الصفية من فريق
التقويم الخارجي (هيئة تقويم التعليم والتدريب)، وهو **محفوظ هنا للرجوع إليه، وغير منشور في الموقع**.

## المحتوى

| المسار | الوصف |
|---|---|
| `model-lesson-template.pptx` | الملف الجاهز: 17 شريحة للعرض و3 مخفية (دليل المعلم) |
| `model-lesson-template.jpg` | صورة معاينة 900×507 لبطاقة الاستوديو |
| `build/` | مولّد الملف: `build.py` (المحتوى) و`lib.py` (أدوات الأشكال بهوية القالب) |
| `build/icons/` | رموز Lucide بألوان الهوية (داكن، أبيض، أخضر) يولّدها `icons.js` |
| `post/` | المنشور الإعلاني: `post.html` والصورة العريضة 1600×900 والنص المرافق |

## إعادة توليد العرض

العرض مبني فوق قالب الاستوديو `public/templates/presentation-template.pptx` (الخلفيات والشعار والخط)،
وتُكتب الشرائح وملاحظاتها من `build.py`:

```
cd docs/model-lesson/build
python3 build.py ../../../public/templates/presentation-template.pptx ../model-lesson-template.pptx
```

لتوليد الرموز من جديد (يحتاج `react-icons` و`react-dom` و`sharp`): `node icons.js`.

## صورة المنشور

افتح `post/post.html` في المتصفح بعرض 1600×900، أو بالمتصفح دون واجهة:

```
headless_shell --window-size=1600,900 --screenshot=post/model-lesson-wide.png file://$PWD/post/post.html
```

## إن أردنا نشره في الاستوديو لاحقًا

1. انسخ `model-lesson-template.pptx` و`model-lesson-template.jpg` إلى `public/templates/`.
2. أضف هذه البطاقة في آخر `TEMPLATES` في `src/pages/studio/templates.js`:

```js
{
  key: "ppt-model-lesson",
  sections: ["teacher"],
  title: "حصة نموذجية (PowerPoint)",
  desc: "حصة 50 دقيقة لأي مادة: تهيئة وأهداف ونمذجة وتعاوني ومتمايز وبطاقة خروج، مع ملاحظات للمعلم ودليل الزيارة الصفية.",
  download: { href: "/templates/model-lesson-template.pptx", file: "حصة-نموذجية-مدرسة-مكة-الثانوية.pptx",
    preview: "/templates/model-lesson-template.jpg", app: "PowerPoint", color: "#C43E1C", ratio: "16 / 9" },
  fields: [], defaults: () => ({}),
},
```

## ملاحظة الخط

الخط IBM Plex Sans Arabic كما في قالب الاستوديو. إن لم يكن مثبتًا على جهاز العرض يستبدله PowerPoint بخط آخر.
للمعاينة المحلية بـ LibreOffice: حوّل ملفات `public/fonts/*.woff2` إلى TTF، وادمج ملف العربي مع اللاتيني لكل
وزن (`fontTools.merge`)، وإلا ظهرت الأرقام بخط بديل.
