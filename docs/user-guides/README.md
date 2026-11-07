# أدلة المستخدمين (PDF)

لكل مستفيد دليل PDF بهوية استوديو البوابة الفاتحة، مدعّم بصور من البوابة نفسها ببيانات تجريبية.

- المحتوى: إجراءات `PROCS` في `src/pages/Help.jsx` («دليل الاستخدام» داخل البوابة) بحسب `who`، فيبقى الدليلان على نص واحد.
- إعداد كل دليل (العنوان، والفئة، وترتيب الأقسام وأسماؤها، وربط الصور بالإجراءات): `harness/guides.js`.
- الصور: `harness/list.mjs` يحدد صفحات كل دليل، و`harness/fixtures.js` بياناتها التجريبية (أسماء وهمية).

## إعادة البناء

    node docs/user-guides/harness/shoot.mjs teacher   # لقطات الجوال إلى harness/img/teacher
    node docs/user-guides/harness/build.mjs teacher   # الدليل إلى docs/user-guides/دليل-المعلم.pdf

الصور لا تُرفع إلى المستودع (تُعاد بـ shoot.mjs)، والملفات هنا لا تُنشر مع الموقع.
