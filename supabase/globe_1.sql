-- =====================================================================
-- برنامج جلوب البيئي العالمي (الجزء 1 من 1): طلاب البرنامج.
-- • globe_members: طلاب البرنامج من كل الفصول، بجوال الطالب للتواصل.
-- • صلاحية «برنامج جلوب» (globe) تُسند لدور البرنامج تلقائيًا هنا، ويمكن إسنادها لغيره
--   من شاشة الصلاحيات؛ والمدير والدعم الفني دائمًا (has_permission).
-- • globe_roster: جوال ولي الأمر لكل طالب، لمن يملك الصلاحية وحده.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.globe_members (
  student_id     uuid primary key references public.students(id) on delete cascade,
  student_mobile text check (student_mobile is null or student_mobile ~ '^9665[0-9]{8}$'),
  added_by       uuid default auth.uid(),
  added_by_name  text,
  added_at       timestamptz not null default now()
);
alter table public.globe_members enable row level security;

drop policy if exists globe_members_read on public.globe_members;
create policy globe_members_read on public.globe_members for select to authenticated
  using (public.has_permission('globe') or public.is_admin());
drop policy if exists globe_members_write on public.globe_members;
create policy globe_members_write on public.globe_members for all to authenticated
  using (public.has_permission('globe')) with check (public.has_permission('globe'));

-- دور البرنامج يملك الصلاحية
insert into public.role_permissions (role_type, permission)
values ('globe_program', 'globe') on conflict do nothing;

-- جوال ولي الأمر لكل طالب في البرنامج
create or replace function public.globe_roster()
returns table (student_id uuid, mobile text)
language sql stable security definer set search_path = public as $$
  select m.student_id,
         (select g.mobile from public.guardian_student gs join public.guardians g on g.id = gs.guardian_id
           where gs.student_id = m.student_id and coalesce(g.mobile, '') <> ''
           order by gs.is_primary desc, g.is_active desc limit 1)
    from public.globe_members m
   where public.has_permission('globe');
$$;
revoke execute on function public.globe_roster() from public, anon;
grant execute on function public.globe_roster() to authenticated, service_role;

-- للتحقق
select count(*) as "طلاب البرنامج",
       exists (select 1 from public.role_permissions where role_type = 'globe_program' and permission = 'globe') as "الصلاحية مسندة"
  from public.globe_members;
-- نهاية الجزء 1
