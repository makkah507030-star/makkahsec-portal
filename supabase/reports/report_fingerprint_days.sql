-- أيام البصمة الفعلية لحساب معدلها اليومي في تقرير البوابة — قراءة فقط
-- daily_attendance صف واحد لكل طالب في اليوم (أول بصمة)، فالعدد = طلاب بصموا
-- يُشغَّل في Supabase ← SQL Editor ← Run، وتُرسل النتيجة كاملة (صف لكل يوم)
select attend_date as "اليوم",
       count(*) as "طلاب بصموا",
       count(*) filter (where source = 'device') as "من الأجهزة"
from public.daily_attendance
group by attend_date
order by attend_date;
-- نهاية الاستعلام
