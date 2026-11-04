-- تبديل حصتين في جدول صف 305 يوم الثلاثاء (4 نوفمبر 2026):
-- النشاط (تركي الحازمي) من الثانية إلى الثالثة، والتقنية الرقمية (محمد البركاتي) من الثالثة إلى الثانية.
-- الحصتان تُحددان بالمادة ورقم الحصة، والعام والفصل من إعداد البوابة (active_year وactive_term).
-- يبدّل رقم الحصة ووقتها في الصفين نفسيهما، فيبقى لكل معلم سجل حضوره.
-- إن لم يجد الحصتين بالضبط يتوقف ويذكر ما وجده في ثلاثاء صف 305. الثلاثاء = 3 في الجدول.
do $$
declare v_year text; v_term int; a uuid; b uuid; na int; nb int; seen text; a_st time; a_en time; b_st time; b_en time;
begin
  select value into v_year from public.settings where key = 'active_year';
  select value::int into v_term from public.settings where key = 'active_term';

  select count(*), (array_agg(s.id))[1] into na, a from public.schedule s
    join public.classes c on c.id = s.class_id left join public.subjects sub on sub.id = s.subject_id
  where c.grade = 3 and c.class_no in (305, 5) and s.day_of_week = 3 and s.period_no = 2
    and s.academic_year = v_year and s.term = v_term and sub.name like '%نشاط%';
  select count(*), (array_agg(s.id))[1] into nb, b from public.schedule s
    join public.classes c on c.id = s.class_id left join public.subjects sub on sub.id = s.subject_id
  where c.grade = 3 and c.class_no in (305, 5) and s.day_of_week = 3 and s.period_no = 3
    and s.academic_year = v_year and s.term = v_term and sub.name like '%تقني%';

  if na <> 1 or nb <> 1 then
    select string_agg(format('ح%s %s (%s، %s ف%s)', s.period_no, coalesce(sub.name, '؟'), c.class_no, s.academic_year, s.term), ' · '
                      order by s.academic_year desc, s.term, s.period_no) into seen
    from public.schedule s join public.classes c on c.id = s.class_id left join public.subjects sub on sub.id = s.subject_id
    where c.grade = 3 and c.class_no in (305, 5) and s.day_of_week = 3;
    raise exception 'وُجد للنشاط في الثانية % وللتقنية في الثالثة % (المطلوب 1 و1) في % ف%. حصص ثلاثاء 305: %',
      na, nb, v_year, v_term, coalesce(seen, 'لا شيء');
  end if;

  -- قيد uq_schedule_slot يمنع حصتين في خانة واحدة ويُفحص صفًّا صفًّا، فتُخرج حصة النشاط من العام مؤقتًا
  select start_time, end_time into a_st, a_en from public.schedule where id = a;
  select start_time, end_time into b_st, b_en from public.schedule where id = b;
  update public.schedule set academic_year = v_year || '~نقل' where id = a;
  update public.schedule set period_no = 2, start_time = a_st, end_time = a_en where id = b;
  update public.schedule set period_no = 3, start_time = b_st, end_time = b_en, academic_year = v_year where id = a;
end $$;

-- الجدول بعد التبديل: صف 305 يوم الثلاثاء
select s.period_no "الحصة", sub.name "المادة", u.full_name "المعلم", s.start_time "من", s.end_time "إلى"
from public.schedule s join public.classes c on c.id = s.class_id join public.users u on u.id = s.teacher_id
left join public.subjects sub on sub.id = s.subject_id
where c.grade = 3 and c.class_no in (305, 5) and s.day_of_week = 3
  and s.academic_year = (select value from public.settings where key = 'active_year')
  and s.term = (select value::int from public.settings where key = 'active_term')
order by s.period_no;
-- نهاية الجزء 1
