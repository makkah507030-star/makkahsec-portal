# المواد التعريفية لبوابة مكة الثانوية الرقمية

مصادر النشرات المطبوعة وفيديوهات الموشن جرافيك للفئات الأربع (المعلم، الإدارة، ولي الأمر، الطالب).
هذا المجلد مستقل عن الموقع ولا يدخل في بنائه.

| الملف | المحتوى |
|---|---|
| `build.py` | نصوص الفئات الأربع (الخدمات، العناوين، خطوات الدخول) + توليد النشرات HTML |
| `style.css` | تصميم النشرة المطبوعة (A4) |
| `render.cjs` | تحويل النشرات إلى PDF في `out/` |
| `motion.py` / `motion.css` | مشاهد الفيديو وتوقيت الحركات (30 ثانية، 1080×1920) |
| `rec.cjs` | تصدير الفيديو إطارًا بإطار إلى MP4 |
| `sfx.py` | توليد أصوات الحركات برمجيًا (بدون موسيقى) |
| `snap.cjs` / `sheet.py` | لقطات مراجعة عند أزمنة محددة |
| `VOICEOVER.md` | نص التعليق الصوتي باللهجة السعودية مع التوقيت |
| `out/` | النشرات النهائية PDF |

الخط والألوان والشعار مأخوذة من الموقع نفسه (`public/fonts`، `tailwind.config.js`، `src/assets`).
لتعديل نص أي فئة: عدّل قاموس `FLYERS` في `build.py` ثم أعد التوليد.

## إعادة التوليد

المتطلبات: Python 3 و Node.js مع Playwright (Chromium).

```
pip install segno numpy scipy imageio-ffmpeg
npm i -g playwright

# النشرات PDF
python3 build.py && node render.cjs

# الفيديوهات
python3 motion.py
FF=$(python3 -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())")
for k in teacher admin guardian student; do node rec.cjs $k $FF; done

# أصوات الحركات ودمجها
python3 sfx.py
for k in teacher admin guardian student; do
  $FF -y -i out/makkahsec-motion-$k.mp4 -i sfx-$k.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest out/makkahsec-motion-$k-sfx.mp4
done
```

ملفات الفيديو لا تُحفظ في المستودع لحجمها (تُولَّد بالأوامر أعلاه).
