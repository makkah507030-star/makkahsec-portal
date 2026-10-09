-- =====================================================================
-- شواهد سجل المتابعة الإلكتروني الثاني — الجزء 1 من 2: perf_auto_counts.
-- بنود السجل الثاني تُحفظ بالبادئة r2_ (r2_homework…)، فكانت تُعدّ أنواعًا
-- مستقلة عن بنود السجل الأول وتظهر بأسمائها البرمجية. تُوحَّد هنا بحذف البادئة.
-- تكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.perf_auto_counts(p_uid uuid, p_year text)
returns table (teacher_user_id uuid, item_key text, cnt bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  staff boolean := public.has_admin_role(array['principal', 'tech_support']);
  y_start timestamptz;
begin
  if not staff and (p_uid is null or p_uid is distinct from auth.uid()) then
    raise exception 'غير مصرّح';
  end if;
  -- بداية العام الدراسي من التقويم، وإلا آخر 12 شهرًا (للجداول التي لا تحمل العام)
  select min(start_date)::timestamptz into y_start
    from public.academic_calendar where academic_year = p_year;
  y_start := coalesce(y_start, now() - interval '1 year');

  return query
  with q as (   -- اختبارات الدورة للعام
    select z.id, z.teacher_id as uid, z.period, z.mode, z.status, z.analyzed_at, z.created_at
      from public.quizzes z
     where (p_uid is null or z.teacher_id = p_uid)
       and coalesce(z.academic_year, p_year) = p_year
       and z.period in ('diagnostic', 'period1', 'period2')
  ),
  marked as (   -- اختبارات لها درجات مرصودة، وتاريخ آخر رصد
    select q.id, q.uid, max(s.marked_at) as at
      from q join public.quiz_submissions s on s.quiz_id = q.id
     where s.score is not null
     group by q.id, q.uid
  ),
  pl as (
    select p.teacher_id as uid, p.kind, p.status, p.created_at, p.done_at, p.skills
      from public.quiz_plans p join q on q.id = p.quiz_id
  ),
  t as (select tt.id, tt.user_id as uid from public.teachers tt where tt.user_id is not null
                                                       and (p_uid is null or tt.user_id = p_uid)),
  fu as (       -- سجل المتابعة الإلكتروني
    select t.uid, regexp_replace(f.item_key, '^r2_', '') as k, f.updated_at   -- السجل الثاني يبدأ بـ r2_
      from public.teacher_follow_up f join t on t.id = f.teacher_id
     where f.academic_year = p_year
  ),
  rows as (
    select uid, 'e11_01'::text as k, created_at as at from q where period = 'diagnostic' and status <> 'draft'
    union all select uid, 'e11_05', created_at from q where period in ('period1', 'period2') and status <> 'draft'
    union all select uid, 'e11_07', created_at from q where status <> 'draft'
    union all select uid, 'e07_06', created_at from q where mode = 'online' and status <> 'draft'
    union all select uid, 'e05_02', at from marked
    union all select uid, 'e03_02', at from marked
    union all select uid, 'e10_03', at from marked
    union all select uid, 'e11_04', at from marked
    union all select uid, 'e10_01', analyzed_at from q where analyzed_at is not null
    union all select uid, 'e10_02', analyzed_at from q where analyzed_at is not null
    union all select uid, 'e05_05', created_at from pl where kind = 'remedial' and coalesce(skills, '') <> ''
    union all select uid, 'e05_06', created_at from pl where kind = 'remedial'
    union all select uid, 'e05_07', created_at from pl where kind = 'enrichment'
    union all select uid, 'e06_04', done_at from pl where kind = 'remedial' and status = 'done'
    union all select uid, 'e06_05', done_at from pl where kind = 'enrichment' and status = 'done'
    -- إشعارات المعلم لفصوله وأولياء أمورهم. التواصل مع أولياء الأمور (3-1): ما وصل ولي أمر واحدًا على الأقل
    union all select n.created_by, 'e03_01', n.created_at from public.notifications n
               where not n.is_auto and n.created_at >= y_start and (p_uid is null or n.created_by = p_uid)
                 and n.created_by in (select uid from t)
                 and exists (select 1 from public.notification_recipients nr
                                  join public.users u on u.id = nr.user_id
                                 where nr.notification_id = n.id and u.role = 'guardian')
    union all select n.created_by, 'e05_04', n.created_at from public.notifications n
               where not n.is_auto and n.created_at >= y_start and (p_uid is null or n.created_by = p_uid)
                 and n.created_by in (select uid from t)
    -- سجل المتابعة: يوم عمل لكل تاريخ رصد
    union all select uid, 'e03_06', max(updated_at) from fu group by uid, updated_at::date
    -- الشهادات التي أصدرها المعلم لطلابه
    union all select d.created_by, 'e05_10', d.created_at
                from public.form_documents d join public.form_templates ft on ft.id = d.template_id
               where ft.category = 'certificate' and d.student_id is not null
                 and d.status not in ('draft', 'pending', 'rejected') and d.created_at >= y_start
                 and (p_uid is null or d.created_by = p_uid) and d.created_by in (select uid from t)
  )
  select r.uid, r.k, count(*), max(r.at) from rows r group by r.uid, r.k
  union all
  -- تنوع المصادر والأساليب: عدد أنواع أعمدة سجل المتابعة المستخدمة (واجبات، مشاركة، تطبيقات، نظري، عملي)
  select fu.uid, x.k, count(distinct fu.k), max(fu.updated_at)
    from fu cross join (values ('e11_02'), ('e11_03')) as x(k)
   group by fu.uid, x.k;
end;
$$;

revoke execute on function public.perf_auto_counts(uuid, text) from public, anon;
grant  execute on function public.perf_auto_counts(uuid, text) to authenticated;
-- نهاية الجزء 1
