-- شواهد الأداء الوظيفي لمحضر معمل الحاسب الآلي (2 من 3): العدّادات الآلية من عمل المعمل في البوابة،
-- بصيغة perf_auto_counts نفسها (المستخدم، البند، العدد، آخرها) في العام الدراسي.
-- لمحضر المعمل نفسه، ولمدير المدرسة والدعم الفني. يُنفَّذ بعد الجزء 1 وcomputer_lab_*.sql. تكرار التنفيذ آمن.

create or replace function public.lab_perf_auto(p_uid uuid, p_year text)
returns table (teacher_user_id uuid, item_key text, cnt bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare y0 date;
begin
  if not exists (select 1 from admin_roles r where r.user_id = p_uid and r.role_type::text = 'computer_lab')
     or not (p_uid = auth.uid() or public.has_admin_role(array['principal', 'tech_support'])) then return; end if;
  select coalesce(min(start_date), current_date - 365) into y0 from academic_calendar where academic_year = p_year;
  return query
  select p_uid, x.k, x.n, x.l from (
    select 'l02_05' k, count(distinct b.teacher_id) n, max(b.created_at) l from lab_bookings b where b.booking_date >= y0
    union all select 'l04_01', count(*), max(s.created_at) from lab_sessions s where s.created_at >= y0
    union all select 'l05_01', count(*), max(r.scanned_at) from lab_results r where r.scanned_at >= y0
    union all select 'l05_02', count(*), max(w.created_at) from lab_works w where w.work_date >= y0
    union all select 'l06_01', count(*), max(b.created_at) from lab_bookings b where b.booking_date >= y0
    union all select 'l07_01', count(*), max(t.updated_at) from lab_tickets t where t.status = 'resolved' and t.created_at >= y0
    union all select 'l07_02', count(*), max(d.updated_at) from lab_devices d where coalesce(d.cpu, d.os, d.ram) is not null
    union all select 'l07_03', count(*), max(i.created_at) from lab_installs i
    union all select 'l08_01', count(*), max(d.updated_at) from lab_devices d where d.status = 'ok'
    union all select 'l09_01', coalesce(max(jsonb_array_length(u.items)), 0), max(u.updated_at) from lab_rules u
    union all select 'l09_02', count(distinct a.student_id), max(a.acked_at) from lab_rule_acks a where a.acked_at >= y0
    union all select 'l10_01', count(distinct st.class_id), max(st.updated_at) from lab_seats st
    union all select 'l11_01', count(*), max(b.booking_date)::timestamptz from lab_bookings b
       where b.booking_date between y0 and current_date and coalesce(b.used, true)
    union all select 'l11_02', count(*), max(b.booking_date)::timestamptz from lab_bookings b where b.walk_in and b.booking_date >= y0
    union all select 'l12_01', count(distinct date_trunc('week', b.booking_date + 1)), max(b.booking_date)::timestamptz
       from lab_bookings b where b.booking_date between y0 and current_date
    union all select 'l13_01', count(*), max(d.updated_at) from lab_devices d
    union all select 'l13_02', count(*), max(t.created_at) from lab_tickets t where t.created_at >= y0
    union all select 'l13_03', count(*), max(t.updated_at) from lab_tickets t where t.status = 'external' and t.created_at >= y0
  ) x where x.n > 0;
end; $$;
revoke execute on function public.lab_perf_auto(uuid, text) from public, anon;
grant execute on function public.lab_perf_auto(uuid, text) to authenticated;
-- نهاية الجزء 2
