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

## فيديوهات أدوات الفئات (52 ثانية، بتعليق صوتي)

فيديو لكل فئة يعرض أدواتها بلقطات حقيقية من البوابة (الأسماء مموّهة)، بنسختين: موسيقى فقط، وبتعليق صوتي.
المعلم وولي الأمر بخلفية داكنة، والإدارة والطالب بخلفية بيضاء. الشريحة الأخيرة: «ستون عامًا من الريادة» ثم مدير المدرسة.

| الملف | المحتوى |
|---|---|
| `motion_teacher.py` | فيديو المعلم + القوالب المشتركة (المشاهد، الانتقالات، الشريحة الختامية، التوقيتات) |
| `motion_admin.py` / `motion_student.py` / `motion_guardian.py` | فيديوهات الفئات الأخرى (الإدارة تعرّف الثيم الأبيض `LIGHT`) |
| `sfx_lib.py` | مكتبة الأصوات المولَّدة (ظهور الشعار، الانتقالات، النقرات) |
| `sfx_pro.py` / `sfx_admin.py` / `sfx_student.py` / `sfx_guardian.py` | أصوات كل فيديو + الموسيقى |
| `music.py` / `music_bed.py` | عينات الموسيقى، والموسيقى المعتمدة (العينة 2) |
| `vo/*.mp3` | التعليق الصوتي (ElevenLabs — Mohammed Almansari — Multilingual v2) |
| `VOICEOVER-tools.txt` | نصوص التعليق الصوتي |
| `vo_fit.py` | يقصّر الوقفات (وعند الحاجة يسرّع قليلًا) ليدخل التسجيل في شريحته |
| `vo_mix.py` | دمج الصوت مع المؤثرات والموسيقى مع خفض الموسيقى أثناء الكلام |
| `rec_part.cjs` | تصدير جزء من الفيديو إطارًا بإطار (تُصدَّر 4 أجزاء بالتوازي) |
| `snap_tools.cjs` | لقطات مراجعة عند أزمنة محددة |
| `asr.py` | تفريغ التسجيل إلى نص (Whisper small عبر sherpa-onnx) لمطابقة العبارات المكتوبة |
| `build_videos.sh` | يبني الفيديوهات الثمانية في `out/final/` |

**مهم:** مجلد `shots/` (لقطات البوابة) غير مرفوع لأن المستودع عام — احتفظ به خارجه وضعه في هذا المجلد قبل البناء.
الملفات المطلوبة فيه: `admin-dash-main.jpg admin-notify.jpg admin-report.jpg st-schedule.jpg st-quiz.jpg st-record.jpg g-home.jpg g-notify.jpg g-results.jpg scan.jpg grades.jpg cert.jpg`.

```
./build_videos.sh                 # الأربعة
./build_videos.sh guardian        # فئة واحدة
```

لتعديل تسجيل: استبدل الملف في `vo/` بنفس الاسم وأعد البناء. توقيت بداية كل سطر في `build_videos.sh`.
