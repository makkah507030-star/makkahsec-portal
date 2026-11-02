-- ملف محضر المعمل الرقمي (2 من 2): بيانات الملف للزائر برمزه دون دخول، كما dfile_public للمعلم.
-- أرقام المعمل (التشغيل والأجهزة والصيانة والسلامة والدروس)، وتغطية بنود الأداء، والشواهد المرفوعة
-- بعناوينها فقط. لا أسماء طلاب. يُنفَّذ بعد الجزء 1. تكرار التنفيذ آمن.

create or replace function public.lab_dfile_public(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f public.lab_dfiles; y text := (select value from public.settings where key = 'active_year'); u uuid;
begin
  select d.* into f from public.lab_dfiles d join public.users x on x.id = d.user_id
   where d.code = upper(trim(p_code)) and d.disabled_at is null and x.is_active;
  if not found then return jsonb_build_object('status', 'off'); end if;
  u := f.user_id;
  return jsonb_build_object('status', 'ok', 'kind', 'lab',
    'settings', jsonb_build_object('code', f.code, 'color', f.color, 'hidden', f.hidden, 'appoint_year', f.appoint_year,
      'perf_rating', f.perf_rating, 'perf_year', f.perf_year, 'other_wins', f.other_wins, 'lab_author', f.lab_author),
    'data', jsonb_build_object(
      'name', (select full_name from users where id = u), 'year', y,
      'devices', (select jsonb_build_object('n', count(*), 'ok', count(*) filter (where status = 'ok'),
                   'broken', count(*) filter (where status = 'broken'), 'maint', count(*) filter (where status = 'maintenance'),
                   'specs', count(*) filter (where coalesce(cpu, os, ram) is not null)) from lab_devices),
      'tickets', (select jsonb_build_object('n', count(*), 'resolved', count(*) filter (where status = 'resolved'),
                   'external', count(*) filter (where status = 'external'), 'open', count(*) filter (where status in ('new', 'in_progress')),
                   'hours', round(avg(extract(epoch from updated_at - created_at) / 3600) filter (where status = 'resolved')::numeric, 1))
                   from lab_tickets),
      'cats', (select coalesce(jsonb_agg(jsonb_build_object('t', category, 'n', n) order by n desc), '[]') from (
                 select category, count(*) n from lab_tickets group by 1 order by 2 desc limit 6) c),
      'use', (select jsonb_build_object('done', count(*) filter (where booking_date <= current_date and coalesce(used, true)),
                'unused', count(*) filter (where used is false), 'walk_in', count(*) filter (where walk_in),
                'teachers', count(distinct teacher_id), 'classes', count(distinct class_id),
                'days', count(distinct booking_date) filter (where booking_date <= current_date)) from lab_bookings),
      'weeks', (select coalesce(jsonb_agg(jsonb_build_object('w', w, 'n', n) order by w), '[]') from (
                  select (date_trunc('week', booking_date + 1) - interval '1 day')::date w, count(*) n from lab_bookings
                   where booking_date <= current_date and coalesce(used, true) group by 1 order by 1 desc limit 12) x),
      'rules', (select coalesce(items, '[]') from lab_rules where id = 1),
      'acks', (select count(distinct student_id) from lab_rule_acks),
      'seats', (select jsonb_build_object('classes', count(distinct class_id), 'students', count(distinct student_id)) from lab_seats),
      'digital', jsonb_build_object('author', f.lab_author, 'installs', (select count(*) from lab_installs),
                   'sessions', (select count(*) from lab_sessions), 'results', (select count(*) from lab_results),
                   'mastery', (select round(avg(mastery)) from lab_results), 'works', (select count(*) from lab_works),
                   'by_lesson', (select coalesce(jsonb_agg(jsonb_build_object('id', x.lesson_id, 'n', x.n, 'st', x.st, 'm', x.m)), '[]') from (
                      select s.lesson_id, count(distinct s.id) n, count(r.student_id) st, round(avg(r.mastery)) m
                        from lab_sessions s left join lab_results r on r.session_id = s.id group by 1) x)),
      'cover', (select coalesce(jsonb_object_agg(e, jsonb_build_object('on', o, 'of', t)), '{}') from (
                  select i.element_key e, count(*) t,
                         count(*) filter (where exists (select 1 from perf_evidence v where v.teacher_user_id = u and v.item_key = i.key and v.academic_year = y)
                                             or exists (select 1 from lab_perf_auto_core(u, y) a where a.item_key = i.key)) o
                    from perf_items i join perf_elements el on el.key = i.element_key
                   where el.track = 'lab' and not el.evaluator_only and i.is_active group by 1) c),
      'docs', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'title', v.title, 'el', i.element_key,
                  'kind', case when v.file_name ~* '\.pdf$' then 'pdf' else 'image' end, 'date', coalesce(v.event_date, v.created_at::date))
                  order by v.created_at desc), '[]')
                 from perf_evidence v join perf_items i on i.key = v.item_key join perf_elements el on el.key = i.element_key
                where v.teacher_user_id = u and el.track = 'lab' and v.source = 'upload' and v.file_path is not null
                  and not ('docs' = any(f.hidden)))));
end; $$;
revoke execute on function public.lab_dfile_public(text) from public;
grant execute on function public.lab_dfile_public(text) to anon, authenticated;
-- نهاية الجزء 2
