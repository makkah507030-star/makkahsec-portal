-- =====================================================================
-- بنك الأنشطة (الجزء 4): تفاصيل شواهد الأنشطة في ملف الأداء، وتقرير استخدام المعلمين للوكيل
-- يُشغَّل بعد activities_1 و_2. تكرار التنفيذ آمن.
-- =====================================================================

-- تفاصيل البنود الآلية 4-2 و8-4 و9-5: كل نشاط نُفّذ (بتاريخه وفصله وتقييمه)، ونقاط دوري المادة وكأسها
create or replace function public.perf_activity_details(p_uid uuid, p_year text, p_item text)
returns table (r_title text, r_detail text, r_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare y_start timestamptz;
begin
  if p_uid is distinct from auth.uid() and not public.activity_manager()
     and not public.has_admin_role(array['principal', 'tech_support']) then
    raise exception 'غير مصرّح'; end if;
  select min(start_date)::timestamptz into y_start from public.academic_calendar where academic_year = p_year;
  y_start := coalesce(y_start, now() - interval '1 year');
  return query
  select c.title::text,
         ((case a.context when 'class' then 'نشاط صفي' else 'حصة انتظار' end)
           || coalesce(' · الفصل ' || k.class_no, '')
           || case a.rating when 1 then ' · 👍' when -1 then ' · 👎' else '' end)::text,
         a.used_on::timestamptz
    from public.activity_uses a
    join public.activity_cards c on c.id = a.card_id
    left join public.classes k on k.id = a.class_id
   where a.user_id = p_uid and a.created_at >= y_start
     and (p_item = 'e08_04' or (p_item = 'e04_02' and a.context = 'class')
          or (p_item = 'e09_05' and c.section = 'coop'))
  union all
  select (case when bool_or(p.group_id is not null) then 'نقاط كأس المادة' else 'نقاط دوري المادة' end)::text,
         (coalesce('الفصل ' || k.class_no || ' · ', '') || count(*) || ' منحة · '
           || sum(p.points) || ' نقطة')::text,
         p.created_at::date::timestamptz
    from public.subject_league_points p
    left join public.classes k on k.id = p.class_id
   where p_item = 'e08_04' and p.created_by = p_uid and p.created_at >= y_start
   group by p.created_at::date, k.class_no, p.group_id is null
  order by 3 desc limit 300;
end $$;
revoke all on function public.perf_activity_details(uuid, text, text) from public, anon;
grant execute on function public.perf_activity_details(uuid, text, text) to authenticated;

-- تقرير الوكيل: لكل معلم أيام الأنشطة (الكل، والصفية، والانتظار، والتعاونية)، وأيام الدوري، وآخر استخدام
create or replace function public.act_usage_report(p_year text)
returns table (user_id uuid, name text, days int, class_days int, waiting_days int, coop_days int,
               league_days int, uses int, likes int, last_on date)
language plpgsql stable security definer set search_path = public as $$
declare y_start timestamptz;
begin
  if not public.activity_manager() and not public.has_admin_role(array['principal']) then
    raise exception 'غير مصرّح'; end if;
  select min(start_date)::timestamptz into y_start from public.academic_calendar where academic_year = p_year;
  y_start := coalesce(y_start, now() - interval '1 year');
  return query
  with u as (select a.user_id uid, a.used_on, a.context, a.rating, c.section from public.activity_uses a
               join public.activity_cards c on c.id = a.card_id where a.created_at >= y_start),
  lp as (select created_by uid, created_at::date d from public.subject_league_points where created_at >= y_start),
  ids as (select uid from u union select uid from lp
          union select t.user_id from public.teachers t where coalesce(t.is_active, true) and t.user_id is not null)
  select i.uid,
         coalesce((select t.full_name from public.teachers t where t.user_id = i.uid limit 1),
                  (select x.full_name from public.users x where x.id = i.uid))::text,
         (select count(distinct d)::int from (select used_on d from u where u.uid = i.uid
                                             union select lp.d from lp where lp.uid = i.uid) z),
         (select count(distinct used_on)::int from u where u.uid = i.uid and context = 'class'),
         (select count(distinct used_on)::int from u where u.uid = i.uid and context = 'waiting'),
         (select count(distinct used_on)::int from u where u.uid = i.uid and section = 'coop'),
         (select count(distinct lp.d)::int from lp where lp.uid = i.uid),
         (select count(*)::int from u where u.uid = i.uid),
         (select count(*)::int from u where u.uid = i.uid and rating = 1),
         greatest((select max(used_on) from u where u.uid = i.uid), (select max(lp.d) from lp where lp.uid = i.uid))
    from ids i where i.uid is not null;
end $$;
revoke all on function public.act_usage_report(text) from public, anon;
grant execute on function public.act_usage_report(text) to authenticated;

-- نهاية الجزء 4
