-- =====================================================================
-- صفة المعلم في شهادات الأحداث: قائمة المعلمين والإدارة في كشف حضور الحدث ومعها تخصص المعلم،
-- فتُكتب صفته تحت اسمه في الشهادة («معلم الرياضيات») بدل «معلم» وحدها، والإداري بمسمّى دوره.
-- يحل محل ev_audience_members في events_audience_2.sql بعمود spec زائد. تكرار التنفيذ آمن.
-- =====================================================================
drop function if exists public.ev_audience_members(uuid, text[]);
create function public.ev_audience_members(p_event uuid, p_kinds text[])
returns table (key text, full_name text, kind text, roles text[], spec text)
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
    select coalesce(t.user_id::text, 't:' || t.id) k, t.full_name n, 'teacher'::text kd, null::text r, nullif(t.specialization, '') s
    from public.teachers t
    where t.is_active and 'teachers' = any(p_kinds) and 'teachers' = any(aud)
    union all
    select r.user_id::text, coalesce(nullif(t.full_name, ''), nullif(u.full_name, ''), u.username),
           'admin', r.role_type::text, nullif(t.specialization, '')
    from public.admin_roles r
    join public.users u on u.id = r.user_id
    left join public.teachers t on t.user_id = r.user_id
    where u.is_active and 'admin' = any(p_kinds) and 'admin' = any(aud)
  )
  select a.k, min(a.n), case when bool_or(a.kd = 'admin') then 'admin' else 'teacher' end,
         array_remove(array_agg(distinct a.r), null), min(a.s)
  from a group by a.k
  order by min(a.n);
end;
$$;
revoke execute on function public.ev_audience_members from public, anon;
grant  execute on function public.ev_audience_members to authenticated;
-- نهاية الجزء 1
