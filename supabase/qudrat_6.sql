-- =====================================================================
-- مركز التدريب — القدرات: بيانات «تقرير متابعة مركز التدريب» لفترة (شهر عادةً)
-- للمدير ووكيل الشؤون التعليمية والدعم الفني (qudrat_manager). يلزم قبله qudrat_1 إلى qudrat_5.
-- تكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.qudrat_report(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not coalesce(qudrat_manager(), false) then raise exception 'التقرير للإدارة فقط'; end if;
  with a as (   -- إجابات الفترة بتاريخ الرياض
    select x.*, (x.created_at at time zone 'Asia/Riyadh')::date d from qudrat_answers x
    where (x.created_at at time zone 'Asia/Riyadh')::date between p_from and p_to
  ), who as (   -- الطالب وصفه وفصله الحاليان
    select s.user_id, s.full_name, v.grade::int grade, v.class_no::int class_no
    from students s
    join lateral (select y.grade, y.class_no from v_active_students y where y.student_id = s.id and y.status = 'active'
                  order by y.academic_year desc limit 1) v on true
    where s.user_id is not null
  ), u as (     -- كل متدرب في الفترة
    select a.user_id, count(*)::int n, count(*) filter (where correct)::int c,
           count(distinct d)::int days, max(created_at) last_at
    from a group by a.user_id
  ), m as (
    select x.*, round(x.correct * 100.0 / nullif(x.total, 0))::int p from qudrat_mocks x
    where (x.created_at at time zone 'Asia/Riyadh')::date between p_from and p_to
  ), k as (
    select x.*, extract(epoch from (x.replied_at - x.created_at)) / 3600 hrs from qudrat_asks x
    where (x.created_at at time zone 'Asia/Riyadh')::date between p_from and p_to
  ), ranked as (
    select u.*, w.full_name, w.grade, w.class_no, round(u.c * 100.0 / u.n)::int p from u left join who w using (user_id)
  )
  select jsonb_build_object(
    'users', (select count(*) from u),
    'answers', (select count(*) from a),
    'correct', (select count(*) from a where correct),
    'active_days', (select round(avg(days), 1) from u),
    'by_grade', (select coalesce(jsonb_agg(jsonb_build_object('g', g, 'students', st, 'users', us, 'answers', an, 'correct', co) order by g), '[]')
                 from (select y.grade::int g, count(distinct y.student_id) st,
                              count(distinct u.user_id) us, coalesce(sum(u.n), 0) an, coalesce(sum(u.c), 0) co
                       from v_active_students y join students s on s.id = y.student_id
                       left join u on u.user_id = s.user_id
                       where y.status = 'active' and y.academic_year = active_year() group by y.grade) t),
    'weeks', (select coalesce(jsonb_agg(jsonb_build_object('wk', wk, 'answers', an, 'users', us) order by wk), '[]')
              from (select date_trunc('week', d + 1)::date - 1 wk, count(*) an, count(distinct user_id) us from a group by 1) t),
    'skills', (select coalesce(jsonb_agg(jsonb_build_object('skill', skill, 'sec', sec, 'answers', an, 'correct', co, 'users', us)), '[]')
               from (select skill, sec, count(*) an, count(*) filter (where correct) co, count(distinct user_id) us from a group by skill, sec) t),
    'mocks', jsonb_build_object('n', (select count(*) from m), 'users', (select count(distinct user_id) from m),
               'avg', (select round(avg(p)) from m), 'best', (select max(p) from m),
               'quant', (select round(avg(quant_pct)) from m), 'verbal', (select round(avg(verbal_pct)) from m)),
    'plans', jsonb_build_object('n', (select count(*) from qudrat_plans),
               'soon', (select count(*) from qudrat_plans where exam_date between current_date and current_date + 30)),
    'asks', jsonb_build_object('n', (select count(*) from k), 'answered', (select count(*) from k where replied_at is not null),
               'voice', (select count(*) from k where reply_audio is not null), 'hrs', (select round(avg(hrs)::numeric, 1) from k),
               'teachers', (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(t.full_name, 'الإدارة (بلا معلم)'),
                              'n', x.n, 'answered', x.ans, 'hrs', x.hrs) order by x.n desc), '[]')
                            from (select teacher_id, count(*) n, count(replied_at) ans, round(avg(hrs)::numeric, 1) hrs
                                  from k group by teacher_id) x left join teachers t on t.id = x.teacher_id)),
    'tq', (select count(*) from qudrat_questions where published),
    'top', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' - 'last_at'), '[]')
            from (select * from ranked order by n desc limit 10) t),
    'support', (select coalesce(jsonb_agg(to_jsonb(t) - 'user_id' - 'last_at'), '[]')
                from (select * from ranked where n >= 20 order by p, n desc limit 10) t)
  ) into r;
  return r;
end $$;
revoke all on function public.qudrat_report(date, date) from public, anon;
grant execute on function public.qudrat_report(date, date) to authenticated;

-- نهاية الجزء 1
