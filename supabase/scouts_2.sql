-- =====================================================================
-- الفريق الكشفي (الجزء 2): القائد الكشفي لمخرجات الفريق.
-- كشف أسماء الفريق، والنماذج والشهادات، وشهادات الأحداث تظهر باسم القائد
-- الكشفي وتوقيعه وصفته، ولو أصدرها نائبه أو غيره من أدوار الكشافة.
-- القائد: صاحب الدور المخصّص الذي اسمه «القائد الكشفي» (لا «نائب…»)،
-- وتوقيعه من «توقيعي». يُنفَّذ في Supabase ← SQL Editor، وتكرار تنفيذه آمن.
-- =====================================================================

create or replace function public.scout_leader()
returns table (user_id uuid, full_name text, label text, sig_path text)
language sql stable security definer set search_path = public as $$
  select u.id, coalesce(nullif(trim(t.full_name), ''), u.full_name), c.label, s.path
  from public.custom_roles c
  join public.admin_roles r on r.role_type = c.role_type
  join public.users u on u.id = r.user_id and u.is_active
  left join public.teachers t on t.user_id = u.id
  left join public.user_signatures s on s.user_id = u.id
  where public.is_school_staff()
    and c.label like '%القائد الكشفي%' and c.label not like '%نائب%'
  order by u.full_name
  limit 1;
$$;

revoke execute on function public.scout_leader() from public, anon;
grant  execute on function public.scout_leader() to authenticated;

-- نهاية الجزء 1
