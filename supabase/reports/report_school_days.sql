-- عدد أيام الدراسة الفعلية لحساب المعدل اليومي في تقرير البوابة — قراءة فقط
-- يُشغَّل في Supabase ← SQL Editor ← Run، وتُرسل النتيجة (صف واحد)
select
  count(distinct attend_date)                                   as "أيام فيها تحضير",
  min(attend_date)                                              as "أول يوم",
  max(attend_date)                                              as "آخر يوم",
  (select count(*) from public.official_attendance_days)        as "أيام في سجل الغياب الرسمي",
  string_agg(distinct to_char(attend_date, 'MM-DD'), ' ' order by to_char(attend_date, 'MM-DD')) as "الأيام"
from public.class_attendance;
-- نهاية الاستعلام
