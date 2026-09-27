#!/usr/bin/env bash
# فيديوهات «أدوات الفئات» (52 ثانية، 1080×1920) — نسخة بالموسيقى فقط + نسخة بالتعليق الصوتي.
# يتطلب مجلد shots/ (لقطات البوابة المموّهة) — غير مرفوع للمستودع لأنه عام. ضعه يدويًا قبل التشغيل.
# الاستخدام: ./build_videos.sh [teacher admin student guardian]
set -euo pipefail
cd "$(dirname "$0")"
[ -d shots ] || { echo "مجلد shots/ غير موجود"; exit 1; }
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
mkdir -p out/final vo/wav

# 1) الصفحات المتحركة + الموسيقى
python3 motion_teacher.py; python3 motion_admin.py; python3 motion_student.py; python3 motion_guardian.py
[ -f music-bed-52.wav ] || python3 music_bed.py

# 2) التعليق الصوتي: mp3 → wav، ثم ضبط الملفات الأطول من شرائحها
for f in vo/*.mp3; do "$FF" -v error -y -i "$f" -ac 1 -ar 48000 "vo/wav/$(basename "${f%.mp3}").wav"; done
W=vo/wav
python3 vo_fit.py $W/outro.wav     $W/outro-f.wav     5.7
python3 vo_fit.py $W/admin-4.wav   $W/admin-4f.wav    9.35
python3 vo_fit.py $W/admin-5.wav   $W/admin-5f.wav    9.1
python3 vo_fit.py $W/student-4.wav $W/student-4f.wav  9.1
"$FF" -v error -y -i $W/teacher-3.wav -af atempo=1.06 $W/teacher-3f.wav

render() {  # $1=key  $2=sfx script  $3..=voice lines
  local key=$1 sfx=$2; shift 2
  for i in 0 1 2 3; do node rec_part.cjs "$key-tools" "$FF" $((i*390)) $(((i+1)*390)) "part-$key-$i.mp4" & done; wait
  printf "file 'part-$key-%d.mp4'\n" 0 1 2 3 > "parts-$key.txt"
  python3 "$sfx" > /dev/null
  local music; music=$(ls -t sfx-*.wav | head -1)
  python3 vo_mix.py "$sfx" "vo-$key.wav" 0.5:$W/intro.wav "$@" 46.0:$W/outro-f.wav
  for pair in "$music makkahsec-$key" "vo-$key.wav makkahsec-$key-voice"; do set -- $pair
    "$FF" -v error -y -f concat -safe 0 -i "parts-$key.txt" -i "$1" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "out/final/$2.mp4"
  done
  echo "✓ $key"
}

for k in ${@:-teacher admin student guardian}; do case $k in
  teacher)  render teacher  sfx_pro.py      3.4:$W/teacher-2.wav 7.9:$W/teacher-3f.wav 19.75:$W/teacher-4.wav 29.6:$W/teacher-5.wav 39.45:$W/teacher-6.wav ;;
  admin)    render admin    sfx_admin.py    3.4:$W/admin-2.wav 7.9:$W/admin-3.wav 19.6:$W/admin-4f.wav 29.6:$W/admin-5f.wav 39.45:$W/admin-6.wav ;;
  student)  render student  sfx_student.py  3.4:$W/student-2.wav 8.2:$W/student-3.wav 19.6:$W/student-4f.wav 29.8:$W/student-5.wav 39.6:$W/student-6.wav ;;
  guardian) render guardian sfx_guardian.py 3.4:$W/guardian-2.wav 8.0:$W/guardian-3.wav 19.6:$W/guardian-4.wav 29.7:$W/guardian-5.wav 39.6:$W/guardian-6.wav ;;
esac; done
