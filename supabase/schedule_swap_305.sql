-- تبديل حصتين في جدول صف 305 يوم الثلاثاء (4 نوفمبر 2026):
-- النشاط (تركي الحازمي) من الثانية إلى الثالثة، والتقنية الرقمية (محمد البركاتي) من الثالثة إلى الثانية.
-- الأسماء في البوابة قد تُكتب بالألف المقصورة («تركى … الحازمى»)، فتُعامل «ى» مثل «ي».
-- يبدّل رقم الحصة ووقتها في الصفين نفسيهما، فيبقى لكل معلم سجل حضوره. يتوقف برسالة إن لم يجد الصفين بالضبط.
-- الثلاثاء = 3 في الجدول. الصف 305 = الصف الثالث، رقم الفصل 305 (أو 5)، في أحدث عام وفصل دراسي في الجدول.
do $$
declare v_class uuid; v_year text; v_term int; a record; b record;
begin
  select s.academic_year, s.term into v_year, v_term from public.schedule s
  order by s.academic_year desc, s.term desc limit 1;
  select id into v_class from public.classes where grade = 3 and class_no in (305, 5) and is_active
  order by academic_year desc, (class_no = 305) desc limit 1;
  if v_class is null then raise exception 'لم يوجد الفصل 305'; end if;

  select s.* into a from public.schedule s join public.users u on u.id = s.teacher_id
  where s.class_id = v_class and s.day_of_week = 3 and s.period_no = 2 and s.academic_year = v_year and s.term = v_term
    and translate(u.full_name, 'ى', 'ي') like 'تركي%' and translate(u.full_name, 'ى', 'ي') like '%الحازمي%';
  if not found then raise exception 'لم توجد حصة تركي الحازمي الثانية يوم الثلاثاء في 305 (إن نُفّذ التبديل من قبل فلا حاجة لإعادته)'; end if;

  select s.* into b from public.schedule s join public.users u on u.id = s.teacher_id
  where s.class_id = v_class and s.day_of_week = 3 and s.period_no = 3 and s.academic_year = v_year and s.term = v_term
    and u.full_name like 'محمد%' and translate(u.full_name, 'ى', 'ي') like '%البركاتي%';
  if not found then raise exception 'لم توجد حصة محمد البركاتي الثالثة يوم الثلاثاء في 305'; end if;

  update public.schedule set period_no = 3, start_time = b.start_time, end_time = b.end_time where id = a.id;
  update public.schedule set period_no = 2, start_time = a.start_time, end_time = a.end_time where id = b.id;
end $$;

-- الجدول بعد التبديل: صف 305 يوم الثلاثاء
select s.period_no "الحصة", sub.name "المادة", u.full_name "المعلم", s.start_time "من", s.end_time "إلى"
from public.schedule s join public.classes c on c.id = s.class_id join public.users u on u.id = s.teacher_id
left join public.subjects sub on sub.id = s.subject_id
where c.grade = 3 and c.class_no in (305, 5) and c.is_active and s.day_of_week = 3
  and (s.academic_year, s.term) = (select academic_year, term from public.schedule order by academic_year desc, term desc limit 1)
order by s.period_no;
-- نهاية الجزء 1
