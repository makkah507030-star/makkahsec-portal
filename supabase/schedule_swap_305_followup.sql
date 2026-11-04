-- ما يترتب على تبديل حصتي صف 305 يوم الثلاثاء (schedule_swap_305.sql):
-- حصص الانتظار وجداول الاختبارات تحفظ رقم الحصة نسخةً وقت إنشائها، فتُضبط على رقمها الجديد
-- من اليوم فصاعدًا (الماضي يبقى كما حدث). يمس حصتي النشاط والتقنية في 305 وحدهما. تكرار التنفيذ آمن.
drop table if exists pg_temp.sw305;
create temp table sw305 as
  select s.id, s.period_no from public.schedule s
  join public.classes c on c.id = s.class_id left join public.subjects sub on sub.id = s.subject_id
  where c.grade = 3 and c.class_no in (305, 5) and s.day_of_week = 3
    and s.academic_year = (select value from public.settings where key = 'active_year')
    and s.term = (select value::int from public.settings where key = 'active_term')
    and (sub.name like '%نشاط%' or sub.name like '%تقني%');

-- تصحيح الجدولين في عبارة واحدة، فيظهر عدد ما صُحّح في محرر Supabase
with sp as (
  update public.substitute_periods x set period_no = w.period_no from sw305 w
  where x.schedule_id = w.id and x.period_no <> w.period_no and x.attend_date >= current_date returning x.id),
ex as (
  update public.exam_slots e set period_no = w.period_no from sw305 w
  where e.schedule_id = w.id and e.period_no is not null and e.period_no <> w.period_no
    and (e.exam_date is null or e.exam_date >= current_date) returning e.id)
select 'حصص الانتظار' "الجدول", (select count(*) from sp) "صُحّح"
union all select 'جداول الاختبارات', (select count(*) from ex);
-- نهاية الجزء 1
