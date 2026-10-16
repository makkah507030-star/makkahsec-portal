-- ملف المعلم الرقمي (الجزء 3): أرقام التقرير دون أسماء طلاب. dfile_data_core للحساب (لا يُستدعى مباشرة)،
-- وdfile_data للمعلم والمدير والدعم الفني، وdfile_public (الجزء 5) للزائر. opinions من الجزء 6.
-- يُنفَّذ بعد الجزأين 1 و2. تكرار التنفيذ آمن.

create or replace function public.dfile_data_core(p_uid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  y text := (select value from public.settings where key = 'active_year');
  tm int := coalesce((select value from public.settings where key = 'active_term')::int, 1);
  tid uuid := (select id from public.teachers where user_id = p_uid);
  y0 timestamptz;
  cls uuid[];
  r jsonb;
begin
  select coalesce(min(start_date)::timestamptz, now() - interval '1 year') into y0
    from public.academic_calendar where academic_year = y;
  select array_agg(distinct class_id) into cls from public.schedule
   where teacher_id = tid and academic_year = y and term = tm;

  select jsonb_build_object(
    'year', y,
    'name', (select full_name from public.users where id = p_uid),
    'spec', (select specialization from public.teachers where id = tid),
    'courses', (select coalesce(jsonb_agg(jsonb_build_object('subject', x.name, 'grade', x.grade, 'classes', x.cls) order by x.grade, x.name), '[]')
                  from (select sb.name, c.grade, jsonb_agg(distinct c.class_no) cls from public.schedule s join public.subjects sb on sb.id = s.subject_id
                          join public.classes c on c.id = s.class_id where s.teacher_id = tid and s.academic_year = y and s.term = tm group by 1, 2) x),
    'classes', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'label', c.class_no::text)
                                 order by c.grade, c.class_no), '[]')
                  from public.classes c where c.id = any(cls)),
    'students', (select count(distinct e.student_id) from public.student_enrollment e
                  where e.class_id = any(cls) and e.academic_year = y and e.status = 'active'),
    'weekly', (select count(*) from public.schedule where teacher_id = tid and academic_year = y and term = tm),
    -- الحصص المحضّرة، ونسبة ما حُضّر في يومه
    'lessons', (select count(distinct (schedule_id, attend_date)) from public.class_attendance
                 where recorded_by = p_uid and academic_year = y),
    'ontime', (select round(100.0 * count(*) filter (where d = attend_date) / nullif(count(*), 0))
                 from (select schedule_id, attend_date, min(recorded_at)::date d from public.class_attendance
                        where recorded_by = p_uid and academic_year = y group by 1, 2) x),
    'subs', (select count(*) from public.substitute_periods where cover_teacher_id = tid and academic_year = y),
    'plc', (select count(*) from public.plc_sessions s where s.status = 'approved' and s.academic_year = y
              and (s.head_user_id = p_uid or s.attendees @> jsonb_build_array(jsonb_build_object('user_id', p_uid)))),
    'plc_led', (select count(*) from public.plc_sessions s
                 where s.status = 'approved' and s.academic_year = y and s.head_user_id = p_uid),
    'xvisits', (select count(*) from public.exchange_visits v where v.status = 'approved' and v.academic_year = y
                  and (v.visitor_user_id = p_uid or v.host_user_id = p_uid)),
    'hours_train', (select coalesce(sum(hours), 0) from public.perf_evidence
                     where teacher_user_id = p_uid and academic_year = y and item_key = 'e02_02'),
    'hours_conf', (select coalesce(sum(hours), 0) from public.perf_evidence
                    where teacher_user_id = p_uid and academic_year = y and item_key = 'e02_05'),
    -- إشعارات وصلت وليّ أمر واحدًا على الأقل
    'guardian_msgs', (select count(*) from public.notifications n
                       where n.created_by = p_uid and not n.is_auto and n.created_at >= y0
                         and exists (select 1 from public.notification_recipients nr join public.users u on u.id = nr.user_id
                                      where nr.notification_id = n.id and u.role = 'guardian')),
    'quizzes', (select coalesce(jsonb_agg(jsonb_build_object('title', z.title, 'mode', z.mode, 'period', z.period,
                  'q', (select count(*) from public.quiz_questions qq where qq.quiz_id = z.id)) order by z.created_at desc), '[]')
                  from public.quizzes z where z.teacher_id = p_uid and z.status <> 'draft'
                   and coalesce(z.academic_year, y) = y),
    'visits', (select coalesce(jsonb_agg(jsonb_build_object('date', d.data->>'f4', 'cls', d.data->>'f3',
                 'by', d.signature_role, 'strengths', d.data->>'f5') order by d.created_at desc), '[]')
                 from public.form_documents d join public.form_templates ft on ft.id = d.template_id
                where d.recipient_user_id = p_uid and ft.key = 'teacher_support_visit'
                  and d.status not in ('draft', 'pending', 'rejected') and d.created_at >= y0),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('title', e.title, 'date', e.event_date,
                 'n', (select count(*) from public.event_participants p where p.event_id = e.id and p.attended is not false))
                 order by e.event_date desc), '[]')
                 from public.school_events e where e.organizer_id = p_uid and e.stage = 'approved'
                  and e.cancelled_at is null and e.event_date >= y0::date),
    -- الشواهد: عددها لكل عنصر، وما رفعه المعلم من ملفات
    'evidence', (select coalesce(jsonb_object_agg(k, n), '{}') from (
                   select left(item_key, 3) k, sum(use_count) n from public.perf_evidence
                    where teacher_user_id = p_uid and academic_year = y group by 1) x),
    'docs', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'name', file_name,
               'date', event_date) order by created_at desc), '[]')
               from public.perf_evidence where teacher_user_id = p_uid and academic_year = y
                and source = 'upload' and file_path is not null),
    'week', public.dfile_week(),
    'grades', public.dfile_grades(p_uid, y),
    'opinions', (select coalesce(jsonb_agg(jsonb_build_object('role', o.author_role, 'name', o.author_name, 'body', o.body, 'at', o.written_at)
                  order by o.author_role = 'principal' desc), '[]')
                  from public.dfile_opinions o where o.teacher_user_id = p_uid and o.decision = 'shown')
  ) into r;
  return r;
end; $$;

revoke execute on function public.dfile_data_core(uuid) from public, anon, authenticated;
create or replace function public.dfile_data(p_uid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare i jsonb; a jsonb;  -- «أثر التطوير» (improvement_loop_5) والشواهد الآلية (perf_auto_core_2) إن وُجدت دالتاهما
begin
  if p_uid is distinct from auth.uid() and not public.has_admin_role(array['principal', 'tech_support']) then raise exception 'غير مصرّح'; end if;
  if to_regprocedure('public.improve_impact(uuid)') is not null then execute 'select public.improve_impact($1)' into i using p_uid; end if;
  if to_regprocedure('public.dfile_auto_evidence(uuid)') is not null then execute 'select public.dfile_auto_evidence($1)' into a using p_uid; end if;
  return public.dfile_data_core(p_uid) || jsonb_build_object('impact', coalesce(i, '[]'::jsonb), 'evidence_auto', coalesce(a, '{}'::jsonb));
end; $$;
revoke execute on function public.dfile_data(uuid) from public, anon;
grant  execute on function public.dfile_data(uuid) to authenticated;
-- نهاية الجزء 3
