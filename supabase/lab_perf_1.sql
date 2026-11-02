-- =====================================================================
-- شواهد الأداء الوظيفي لمحضر معمل الحاسب الآلي (نموذج «محضر المختبر» في الدليل الإرشادي
-- لإدارة الأداء الوظيفي، الإصدار الثاني). الشواهد الآلية تُحسب من جداول المعمل بالدالة
-- lab_perf_stats، والشواهد اليدوية في lab_perf_evidence ومرفقاتها في مخزن perf-evidence.
-- يُنفَّذ بعد computer_lab_1..12.sql وteacher_performance.sql. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.lab_perf_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  academic_year text not null,
  element_key text not null,                 -- lp01..lp13 (src/lib/labPerf.js)
  title text not null,
  note text, event_date date,
  file_path text, file_name text,
  created_at timestamptz not null default now()
);
create index if not exists lab_perf_evidence_user_idx on public.lab_perf_evidence (user_id, academic_year);
alter table public.lab_perf_evidence enable row level security;

drop policy if exists lab_perf_read on public.lab_perf_evidence;
create policy lab_perf_read on public.lab_perf_evidence for select to authenticated
  using (user_id = auth.uid() or public.has_admin_role(array['principal', 'tech_support']));
drop policy if exists lab_perf_write on public.lab_perf_evidence;
create policy lab_perf_write on public.lab_perf_evidence for all to authenticated
  using (user_id = auth.uid() and public.lab_is_manager())
  with check (user_id = auth.uid() and public.lab_is_manager());
grant select, insert, update, delete on public.lab_perf_evidence to authenticated;

-- أرقام المعمل للشواهد الآلية ولملف المعلم الرقمي: لمسؤولي المعمل ومعلمي الحاسب المخوّلين
create or replace function public.lab_perf_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.lab_can_view() then null else jsonb_build_object(
    'devices',          (select count(*) from lab_devices),
    'devices_ok',       (select count(*) from lab_devices where status = 'ok'),
    'devices_specs',    (select count(*) from lab_devices where coalesce(cpu, os, ram) is not null),
    'tickets',          (select count(*) from lab_tickets),
    'tickets_resolved', (select count(*) from lab_tickets where status = 'resolved'),
    'tickets_external', (select count(*) from lab_tickets where status = 'external'),
    'tickets_hours',    (select round(avg(extract(epoch from updated_at - created_at) / 3600)::numeric, 1)
                           from lab_tickets where status = 'resolved'),
    'bookings',         (select count(*) from lab_bookings),
    'bookings_done',    (select count(*) from lab_bookings where booking_date <= current_date and coalesce(used, true)),
    'walk_in',          (select count(*) from lab_bookings where walk_in),
    'booking_teachers', (select count(distinct teacher_id) from lab_bookings),
    'booking_classes',  (select count(distinct class_id) from lab_bookings),
    'booking_days',     (select count(distinct booking_date) from lab_bookings where booking_date <= current_date),
    'booking_weeks',    (select count(distinct date_trunc('week', booking_date + 1)) from lab_bookings where booking_date <= current_date),
    'weeks',            (select coalesce(jsonb_agg(jsonb_build_object('w', w, 'n', n) order by w), '[]') from (
                           select (date_trunc('week', booking_date + 1) - interval '1 day')::date w, count(*) n
                             from lab_bookings where booking_date <= current_date and coalesce(used, true)
                            group by 1 order by 1 desc limit 16) x),
    'rules_items',      (select coalesce(jsonb_array_length(items), 0) from lab_rules where id = 1),
    'rules_version',    (select version from lab_rules where id = 1),
    'acks',             (select count(distinct student_id) from lab_rule_acks),
    'seat_classes',     (select count(distinct class_id) from lab_seats),
    'seat_students',    (select count(distinct student_id) from lab_seats),
    'sessions',         (select count(*) from lab_sessions),
    'session_classes',  (select count(distinct class_id) from lab_sessions),
    'results',          (select count(*) from lab_results),
    'avg_mastery',      (select round(avg(mastery)) from lab_results where mastery is not null),
    'avg_quiz',         (select round(avg(quiz)) from lab_results where quiz is not null),
    'works',            (select count(*) from lab_works),
    'work_marks',       (select count(*) from lab_work_marks),
    'installs',         (select count(*) from lab_installs)
  ) end;
$$;
revoke execute on function public.lab_perf_stats() from public, anon;
grant execute on function public.lab_perf_stats() to authenticated;
-- نهاية الجزء 1
