-- =====================================================================
-- حدث للمدرسة كلها حسب الفئة (الجزء ٢ من ٢): قائمة الأسماء وعدد المستفيدين.
-- يتطلب الجزء ١ قبله. تكرار التنفيذ آمن.
-- =====================================================================

-- أسماء المعلمين والإدارة في فئة الحدث، لكشف الحضور وشهادات من حضر.
-- الطلاب وأولياء الأمور مرفوضون: لا إصدار جماعي لهم، والمكرَّمون منهم يُضافون بالاسم.
-- key: معرّف الحساب، أو t:<معرّف المعلم> لمعلم بلا حساب.
create or replace function public.ev_audience_members(p_event uuid, p_kinds text[])
returns table (key text, full_name text, kind text, roles text[])
language plpgsql stable security definer set search_path = public as $$
declare
  aud text[];
begin
  if p_kinds && array['students', 'guardians'] then
    raise exception 'قائمة الأسماء للمعلمين والإدارة فقط؛ الطلاب وأولياء الأمور المكرَّمون يُضافون بالاسم';
  end if;
  if not public.ev_is_manager(p_event, array['principal', 'tech_support', 'deputy_students',
                                             'deputy_academic', 'activity_leader']) then
    raise exception 'لا تملك صلاحية هذا الحدث';
  end if;
  select e.audience into aud from public.school_events e where e.id = p_event;

  return query
  with a as (
    select coalesce(t.user_id::text, 't:' || t.id) k, t.full_name n, 'teacher'::text kd, null::text r
    from public.teachers t
    where t.is_active and 'teachers' = any(p_kinds) and 'teachers' = any(aud)
    union all
    select r.user_id::text, coalesce(nullif(t.full_name, ''), nullif(u.full_name, ''), u.username),
           'admin', r.role_type::text
    from public.admin_roles r
    join public.users u on u.id = r.user_id
    left join public.teachers t on t.user_id = r.user_id
    where u.is_active and 'admin' = any(p_kinds) and 'admin' = any(aud)
  )
  select a.k, min(a.n), case when bool_or(a.kd = 'admin') then 'admin' else 'teacher' end,
         array_remove(array_agg(distinct a.r), null)
  from a group by a.k
  order by min(a.n);
end;
$$;

revoke execute on function public.ev_audience_members from public, anon;
grant  execute on function public.ev_audience_members to authenticated;

-- المستفيدون الحاضرون في حدث: الطلاب بالاسم (أو كل الطلاب إن كان الحدث لهم)،
-- وأولياء الأمور إن كانوا من فئته، ومن حضر من المعلمين والإدارة.
-- كما في src/lib/eventAudience.js (eventReach)، ويستدعيها الملف الرقمي للمعلم.
create or replace function public.ev_reach(p_event uuid)
returns integer language sql stable security definer set search_path = public as $$
  select (case when 'students' = any(e.audience) then coalesce((e.audience_counts->>'students')::int, 0)
               else (select count(*) from public.event_participants p
                     where p.event_id = e.id and p.attended is not false)::int end)
       + (case when 'guardians' = any(e.audience) then coalesce((e.audience_counts->>'guardians')::int, 0)
               else 0 end)
       + jsonb_array_length(coalesce(e.audience_attended, '[]'::jsonb))
  from public.school_events e where e.id = p_event;
$$;

revoke execute on function public.ev_reach from public, anon;
grant  execute on function public.ev_reach to authenticated;

-- نهاية الجزء 2
