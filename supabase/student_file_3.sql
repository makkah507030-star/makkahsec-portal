-- =====================================================================
-- ملف الطالب الشامل (الجزء 3 من 3): التحصيل والإنجازات — الاختبارات بمتوسط فصله، ونتائج نور،
-- والمعمل، ومركز التدريب، والشهادات والنماذج، والأحداث، ودوري المادة. يُشغَّل بعد الجزء 1.
-- الوحدات الاختيارية (المعمل والقدرات والدوري) تُقرأ إن وُجدت جداولها. تكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.student_file_academic(p_student uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb; v_lab jsonb; v_q jsonb; v_league jsonb; v_uid uuid;
  t0 timestamptz := p_from::timestamptz; t1 timestamptz := (p_to + 1)::timestamptz;
begin
  if not public.sf_can(p_student) then raise exception 'غير مصرّح'; end if;
  select user_id into v_uid from students where id = p_student;
  if to_regclass('public.lab_results') is not null then
    execute $x$select jsonb_build_object('sessions', count(*), 'avg', round(avg(r.quiz)), 'mastery', round(avg(r.mastery)),
        'list', coalesce(jsonb_agg(jsonb_build_object('lesson', s.lesson_title, 'quiz', r.quiz, 'd', r.scanned_at) order by r.scanned_at), '[]'))
      from lab_results r join lab_sessions s on s.id = r.session_id
      where r.student_id = $1 and r.scanned_at >= $2 and r.scanned_at < $3$x$ into v_lab using p_student, t0, t1;
  end if;
  if v_uid is not null and to_regclass('public.qudrat_answers') is not null then
    execute $x$select jsonb_build_object('answers', count(*), 'correct', count(*) filter (where correct),
        'days', count(distinct created_at::date),
        'mocks', (select count(*) from qudrat_mocks m where m.user_id = $1 and m.created_at >= $2 and m.created_at < $3),
        'best', (select max(round(100.0 * m.correct / nullif(m.total, 0))) from qudrat_mocks m
                  where m.user_id = $1 and m.created_at >= $2 and m.created_at < $3))
      from qudrat_answers where user_id = $1 and created_at >= $2 and created_at < $3$x$ into v_q using v_uid, t0, t1;
  end if;
  if to_regclass('public.subject_league_points') is not null then
    execute $x$select coalesce(jsonb_agg(jsonb_build_object('subject', x.name, 'points', x.pts)), '[]') from (
        select sub.name, sum(p.points) pts from subject_league_points p left join subjects sub on sub.id = p.subject_id
         where (p.student_id = $1 or p.group_id in (select g.id from subject_cup_groups g where $1 = any(g.members)))
           and p.created_at >= $2 and p.created_at < $3 group by sub.name) x$x$ into v_league using p_student, t0, t1;
  end if;

  select jsonb_build_object(
    'quizzes', (select coalesce(jsonb_agg(jsonb_build_object('title', q.title, 'subject', q.subject_name, 'period', q.period,
                  'total', q.total_marks, 'score', s.score, 'absent', s.absent, 'd', coalesce(q.exam_date, s.marked_at::date),
                  'class_avg', (select round(avg(o.score), 2) from quiz_submissions o where o.quiz_id = q.id
                                  and o.class_id is not distinct from s.class_id and not o.absent and o.score is not null))
                  order by coalesce(q.exam_date, s.marked_at::date)), '[]')
                 from quiz_submissions s join quizzes q on q.id = s.quiz_id
                where s.student_id = p_student and q.status <> 'draft' and (s.score is not null or s.absent)
                  and coalesce(q.exam_date, s.marked_at::date, q.created_at::date) between p_from and p_to),
    'results', (select coalesce(jsonb_agg(jsonb_build_object('type', r.report_type, 'year', r.academic_year, 'average', r.average,
                  'rank_class', r.rank_class, 'class_count', r.class_count, 'rank_grade', r.rank_grade,
                  'grade_count', r.grade_count) order by r.created_at desc), '[]')
                 from student_results r where r.student_id = p_student),
    'documents', (select coalesce(jsonb_agg(jsonb_build_object('title', d.title, 'serial', d.serial, 'category', t.category,
                  'status', d.status, 'd', d.created_at, 'by', d.signature_name) order by d.created_at), '[]')
                 from form_documents d join form_templates t on t.id = d.template_id
                where d.student_id = p_student and d.status not in ('draft', 'rejected')
                  and d.created_at >= t0 and d.created_at < t1),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('title', e.title, 'category', e.category, 'd', e.event_date,
                  'attended', p.attended, 'cert', p.cert_issued_at is not null) order by e.event_date), '[]')
                 from event_participants p join school_events e on e.id = p.event_id
                where p.student_id = p_student and e.cancelled_at is null and e.event_date between p_from and p_to),
    'lab', v_lab, 'qudrat', v_q, 'league', coalesce(v_league, '[]')
  ) into v;
  return v;
end $$;

revoke all on function public.student_file_academic(uuid, date, date) from public, anon;
grant execute on function public.student_file_academic(uuid, date, date) to authenticated;
-- نهاية الجزء 3
