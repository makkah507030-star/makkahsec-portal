-- =====================================================================
-- التوجيه الطلابي — الجزء 2 من 2: لوحة الإنذار المبكر لموجه الصف.
-- guidance_early_warning(الصف، من تاريخ، بداية احتساب البصمة أو null):
-- طلاب الصف الذين يحتاجون تدخلًا، بحدود البوابة نفسها (الصفحة تقرر العرض):
--   الغياب الرسمي بدون عذر · التأخر الصباحي (حين تُفتح البصمة) · مواد متوسط
--   اختباراتها القصيرة أقل من 60٪ في الفصل النشط · الإحالات وأعلى درجة مخالفة ·
--   ملاحظة صحية نشطة · حالة إرشادية مفتوحة. يُنفَّذ بعد الجزء 1. تكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.guidance_early_warning(p_grade int, p_from date, p_late_from date)
returns table (student_id uuid, full_name text, class_no int, absent_days int, late_days int,
               low_subjects text[], referrals int, max_degree int, health boolean, open_case uuid)
language plpgsql stable security definer set search_path = public as $$
declare y text; t int;
begin
  if not public.guidance_can(p_grade) then raise exception 'غير مصرّح'; end if;
  select value into y from settings where key = 'active_year';
  select value::int into t from settings where key = 'active_term';
  return query
  with st as (
    select distinct v.student_id as sid, v.full_name, v.class_no
      from v_active_students v where v.grade = p_grade and v.status = 'active'
  ), ab as (
    select m.student_id as sid, count(*) filter (where m.status = 'absent')::int as a,
           count(*) filter (where p_late_from is not null and m.attend_date >= p_late_from
                                  and coalesce(m.late_minutes, 0) > 0)::int as l
      from official_day_marks m join st on st.sid = m.student_id
     where m.attend_date >= p_from group by m.student_id
  ), qz as (   -- متوسط كل مادة في الاختبارات القصيرة المرصودة للفصل النشط
    select x.sid, array_agg(x.subj order by x.subj) as subjects from (
      select s.student_id as sid, coalesce(q.subject_name, '—') as subj
        from quiz_submissions s join quizzes q on q.id = s.quiz_id join st on st.sid = s.student_id
       where q.academic_year = y and q.term = t and q.status in ('marking', 'closed')
         and not s.absent and s.score is not null and q.total_marks > 0
       group by s.student_id, coalesce(q.subject_name, '—')
      having avg(s.score / q.total_marks) < 0.6) x
     group by x.sid
  ), rf as (
    select r.student_id as sid, count(*)::int as n, max(r.violation_degree)::int as deg
      from student_referrals r join st on st.sid = r.student_id
     where r.referral_date >= p_from group by r.student_id
  )
  select st.sid, st.full_name, st.class_no, coalesce(ab.a, 0), coalesce(ab.l, 0),
         coalesce(qz.subjects, '{}'), coalesce(rf.n, 0), rf.deg,
         exists (select 1 from student_notes n where n.student_id = st.sid and n.kind = 'health' and n.is_active),
         (select c.id from guidance_cases c where c.student_id = st.sid and c.status = 'open'
           order by c.opened_at desc limit 1)
    from st
    left join ab on ab.sid = st.sid left join qz on qz.sid = st.sid left join rf on rf.sid = st.sid
   where coalesce(ab.a, 0) > 0 or coalesce(ab.l, 0) > 0 or qz.sid is not null or rf.sid is not null
      or exists (select 1 from guidance_cases c where c.student_id = st.sid and c.status = 'open')
   order by st.class_no, st.full_name;
end $$;

revoke execute on function public.guidance_early_warning(int, date, date) from public, anon;
grant  execute on function public.guidance_early_warning(int, date, date) to authenticated;
-- نهاية الجزء 2
