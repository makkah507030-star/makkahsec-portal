@echo off
setlocal enabledelayedexpansion

echo === جاري إضافة التغييرات ===
git add .

REM تجهيز اسم النسخة تلقائيًا: التاريخ والوقت + أسماء الملفات المتغيرة
set "FILES="
for /f "delims=" %%f in ('git diff --cached --name-only') do (
    set "FILES=!FILES!, %%~nxf"
)
if "!FILES!"=="" (
    echo لا توجد تغييرات لرفعها.
    goto :status
)

set "MSG=Update %date% %time% - !FILES:~2!"

echo === الرسالة: %MSG% ===
git commit -m "%MSG%"

echo === جاري السحب من GitHub ===
git pull origin main

echo === جاري الرفع إلى GitHub ===
git push origin main

:status
echo === الحالة النهائية ===
git status

pause
