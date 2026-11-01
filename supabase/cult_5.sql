-- =====================================================================
-- الثقافة المؤسسية (5): جوال الموظف لإرسال بطاقة «نهتم بك» في واتساب على الخاص.
-- يضيف عمود الجوال (من سجل المعلمين) إلى قائمة الموظفين لفريق الثقافة وحده.
-- يُنفَّذ بعد cult_1.sql، وتكرار التنفيذ آمن.
-- =====================================================================
drop function if exists public.cult_staff();
create function public.cult_staff() returns table (id uuid, full_name text, mobile text)
language sql stable security definer set search_path = public as $$
  select u.id, u.full_name,
         (select t.mobile from teachers t where t.user_id = u.id and coalesce(t.mobile, '') <> '' limit 1)
    from users u
   where public.cult_member() and u.is_active and u.role::text in ('teacher', 'admin') and u.full_name is not null
   order by u.full_name;
$$;
revoke all on function public.cult_staff() from public, anon;
grant execute on function public.cult_staff() to authenticated;

-- نهاية الجزء 5
