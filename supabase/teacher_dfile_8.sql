-- ملف المعلم الرقمي (الجزء 8): «السجلات والنماذج» التي يستخدمها المعلم، بأسمائها فقط.
-- • dfile_records: السجلات الآلية التي استخدمها هذا العام في البوابة (مفاتيح تُسمّى في الواجهة)،
--   وأسماء النماذج التي أصدرها. لا أعداد ولا محتوى ولا أسماء طلاب.
-- • teacher_dfiles.records: سجلات ورقية أو خارجية يضيفها المعلم بأسمائها.
-- • dfile_extra: إضافات التقرير في مكان واحد (أثر التطوير، والشواهد الآلية، والسجلات)، يستدعيها
--   dfile_data (الجزء 3) وdfile_public (الجزء 5)؛ فإضافة جديدة تُكتب هنا دون تعديلهما.
-- يُنفَّذ بعد الأجزاء 1 إلى 7 وperf_auto_core. تكرار التنفيذ آمن.

alter table public.teacher_dfiles add column if not exists records jsonb not null default '[]'::jsonb;

create or replace function public.dfile_records(p_uid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  y text := (select value from public.settings where key = 'active_year');
  tid uuid := (select id from public.teachers where user_id = p_uid);
  y0 timestamptz;
begin
  select coalesce(min(start_date)::timestamptz, now() - interval '1 year') into y0
    from public.academic_calendar where academic_year = y;
  return jsonb_build_object(
    'auto', (select coalesce(jsonb_agg(v.k order by v.o), '[]') from (values
      (1, 'attendance', exists (select 1 from public.class_attendance where recorded_by = p_uid and academic_year = y)),
      (2, 'followup',   exists (select 1 from public.teacher_follow_up where teacher_id = tid and academic_year = y)),
      (3, 'grades',     exists (select 1 from public.grade_entries where teacher_user_id = p_uid and academic_year = y)),
      (4, 'quizzes',    exists (select 1 from public.quizzes where teacher_id = p_uid and status <> 'draft' and coalesce(academic_year, y) = y)),
      (5, 'plans',      exists (select 1 from public.quiz_plans pl join public.quizzes z on z.id = pl.quiz_id
                                 where pl.teacher_id = p_uid and coalesce(z.academic_year, y) = y)),
      (6, 'subs',       exists (select 1 from public.substitute_periods where cover_teacher_id = tid and academic_year = y)),
      (7, 'guardians',  exists (select 1 from public.notifications n where n.created_by = p_uid and not n.is_auto and n.created_at >= y0
                                   and exists (select 1 from public.notification_recipients nr join public.users u on u.id = nr.user_id
                                                where nr.notification_id = n.id and u.role = 'guardian')))
      ) as v(o, k, used) where v.used),
    'forms', (select coalesce(jsonb_agg(x.t order by x.t), '[]') from (
      select distinct ft.title t from public.form_documents d join public.form_templates ft on ft.id = d.template_id
       where d.created_by = p_uid and d.status not in ('draft', 'rejected') and d.created_at >= y0) x));
end; $$;

create or replace function public.dfile_extra(p_uid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare i jsonb; a jsonb;
begin
  if to_regprocedure('public.improve_impact(uuid)') is not null then execute 'select public.improve_impact($1)' into i using p_uid; end if;
  if to_regprocedure('public.dfile_auto_evidence(uuid)') is not null then execute 'select public.dfile_auto_evidence($1)' into a using p_uid; end if;
  return jsonb_build_object('impact', coalesce(i, '[]'::jsonb), 'evidence_auto', coalesce(a, '{}'::jsonb),
                            'records', public.dfile_records(p_uid));
end; $$;

revoke execute on function public.dfile_records(uuid) from public, anon, authenticated;
revoke execute on function public.dfile_extra(uuid) from public, anon, authenticated;
-- نهاية الجزء 8
