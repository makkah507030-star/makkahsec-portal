-- مختبرات العلوم (6 من 6): شواهد أداء محضر مختبر العلوم تصل من عمل المختبر في البوابة، ثم staff_perf_auto
-- للواجهة بالمسارات كلها (تحل محل نسخة principal_perf_2.sql). يُنفَّذ بعد الأجزاء 1–5 وprincipal_perf_1..3. تكرار التنفيذ آمن.
update public.perf_items set portal = 'auto', source = 'school'
 where key in ('s04_01', 's09_02', 's10_01', 's12_01', 's12_02', 's13_01', 's13_02');

-- مختبر المحضر من دوره (science_labs للأحياء، science_labs_3 للكيمياء، science_labs_2 للفيزياء)
create or replace function public.sci_perf_auto_core(p_uid uuid, y0 date)
returns table (item_key text, cnt bigint, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  with lb as (select l.key from sci_labs l join admin_roles r on r.role_type::text = l.role_type where r.user_id = p_uid)
  select x.k, x.n, x.l from (
    select 's04_01' k, count(*) n, max(r.run_date)::timestamptz l from sci_runs r join sci_experiments e on e.id = r.experiment_id
     where e.lab in (select key from lb) and r.outcome = 'lab' and r.run_date >= y0
    union all select 's10_01', count(*), max(b.prep_at) from sci_bookings b
     where b.lab in (select key from lb) and b.prep = 'ready' and b.booking_date >= y0
    union all select 's12_01', count(*), max(r.confirmed_at) from sci_runs r join sci_experiments e on e.id = r.experiment_id
     where e.lab in (select key from lb) and r.confirmed_at >= y0
    union all select 's12_02', count(*), max(i.updated_at) from sci_inventory i where i.lab in (select key from lb)
    union all select 's09_02', count(*), max(i.updated_at) from sci_inventory i
     where i.lab in (select key from lb) and i.kind = 'chemical' and i.expiry is not null
    union all select 's13_01', count(*), max(i.updated_at) from sci_inventory i where i.lab in (select key from lb) and i.kind = 'device'
    union all select 's13_02', count(*), max(i.updated_at) from sci_inventory i
     where i.lab in (select key from lb) and i.status in ('damaged', 'missing')
  ) x where x.n > 0;
$$;
revoke execute on function public.sci_perf_auto_core(uuid, date) from public, anon, authenticated;

create or replace function public.staff_perf_auto(p_uid uuid, p_year text)
returns table (teacher_user_id uuid, item_key text, cnt bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare y0 date;
begin
  if not (p_uid = auth.uid() or public.has_admin_role(array['principal', 'tech_support'])) then return; end if;
  select coalesce(min(start_date), current_date - 365) into y0 from academic_calendar where academic_year = p_year;
  return query select p_uid, c.item_key, c.cnt, c.last_at from public.staff_perf_auto_core(p_uid, p_year) c
    union all select p_uid, d.item_key, d.cnt, d.last_at from public.deputy_perf_auto_core(p_uid, y0) d
    union all select p_uid, m.item_key, m.cnt, m.last_at from public.principal_perf_auto_core(p_uid, y0) m
    union all select p_uid, s.item_key, s.cnt, s.last_at from public.sci_perf_auto_core(p_uid, y0) s;
end; $$;
revoke execute on function public.staff_perf_auto(uuid, text) from public, anon;
grant execute on function public.staff_perf_auto(uuid, text) to authenticated;

-- تفاصيل البنود السابقة («عرض الشواهد»)
create or replace function public.sci_perf_details(p_uid uuid, p_year text, p_item text)
returns table (r_title text, r_detail text, r_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare y0 date; labs text[];
begin
  if not (p_uid = auth.uid() or public.has_admin_role(array['principal', 'tech_support'])) then return; end if;
  select coalesce(min(start_date), current_date - 365) into y0 from academic_calendar where academic_year = p_year;
  select array_agg(l.key) into labs from sci_labs l join admin_roles r on r.role_type::text = l.role_type where r.user_id = p_uid;
  return query select * from (
    select e.title t, e.course || ' · فصل ' || c.class_no || case r.outcome when 'lab' then ' · في المختبر' when 'virtual' then ' · افتراضي' else ' · لم تُنفّذ' end d,
           coalesce(r.confirmed_at, r.run_date::timestamptz) w
      from sci_runs r join sci_experiments e on e.id = r.experiment_id join classes c on c.id = r.class_id
     where e.lab = any(labs) and ((p_item = 's04_01' and r.outcome = 'lab' and r.run_date >= y0) or (p_item = 's12_01' and r.confirmed_at >= y0))
    union all select coalesce(e.title, 'حصة مختبر'), coalesce(t.full_name, '') || ' · الحصة ' || b.period_no, b.booking_date::timestamptz
      from sci_bookings b left join sci_experiments e on e.id = b.experiment_id left join teachers t on t.id = b.teacher_id
     where p_item = 's10_01' and b.lab = any(labs) and b.prep = 'ready' and b.booking_date >= y0
    union all select i.name, trim(i.qty::text || ' ' || coalesce(i.unit, '')) || case i.status when 'damaged' then ' · تالف' when 'missing' then ' · ناقص' else '' end
           || coalesce(' · صلاحيته ' || i.expiry, ''), i.updated_at
      from sci_inventory i where i.lab = any(labs) and ((p_item = 's12_02') or (p_item = 's09_02' and i.kind = 'chemical' and i.expiry is not null)
        or (p_item = 's13_01' and i.kind = 'device') or (p_item = 's13_02' and i.status in ('damaged', 'missing')))
  ) q order by 3 desc nulls last;
end; $$;
revoke execute on function public.sci_perf_details(uuid, text, text) from public, anon;
grant execute on function public.sci_perf_details(uuid, text, text) to authenticated;

-- للتحقق: تجارب كل مختبر ومحضره
select l.name as "المختبر", (select count(*) from public.sci_experiments e where e.lab = l.key) as "التجارب",
       (select string_agg(u.full_name, '، ') from public.admin_roles r join public.users u on u.id = r.user_id
         where r.role_type::text = l.role_type) as "المحضر"
  from public.sci_labs l order by l.sort;
-- نهاية الجزء 6
