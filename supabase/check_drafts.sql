-- =====================================================================
-- قراءة فقط: المسودات في البوابة — عددها وعمرها وما فيها، لكل نوع.
-- • الاختبارات: المسودة الفارغة (بلا أسئلة) والتي فيها أسئلة، وأقدمها، وكم منها في دورة
--   الاختبار (التشخيصي والفترتان) فتظهر «دورة مفتوحة عند البناء» في متابعة دورات الاختبار.
-- • الأحداث المتوقفة في مرحلتها الأولى «بيانات الحدث».
-- • حجم الجداول في قاعدة البيانات للمقارنة.
-- يُنفَّذ في Supabase ← SQL Editor.
-- =====================================================================
with qd as (
  select q.id, q.created_at, q.period,
         (select count(*) from public.quiz_questions x where x.quiz_id = q.id) as nq
    from public.quizzes q where q.status = 'draft'
)
select 'اختبارات مسودة' as "النوع",
       count(*)::text as "العدد",
       count(*) filter (where nq = 0)::text || ' فارغة · ' || count(*) filter (where nq > 0) || ' فيها أسئلة' as "التفصيل",
       count(*) filter (where created_at < now() - interval '14 days')::text || ' أقدم من أسبوعين · '
         || count(*) filter (where period in ('diagnostic', 'period1', 'period2')) || ' تظهر دورة مفتوحة' as "العمر والأثر",
       (select count(distinct teacher_id) from public.quizzes where status = 'draft')::text || ' معلمًا' as "المعلمون"
  from qd
union all
select 'أحداث في مرحلة البيانات', count(*)::text,
       count(*) filter (where event_date < current_date)::text || ' تاريخها مضى',
       count(*) filter (where created_at < now() - interval '14 days')::text || ' أقدم من أسبوعين',
       count(distinct organizer_id)::text || ' منظّمًا'
  from public.school_events where stage = 'draft'
union all
select 'حجم قاعدة البيانات كلها', pg_size_pretty(pg_database_size(current_database())), '',
       'الاختبارات وأسئلتها: ' || pg_size_pretty(pg_total_relation_size('public.quizzes') + pg_total_relation_size('public.quiz_questions')), '';
-- نهاية الجزء 1
