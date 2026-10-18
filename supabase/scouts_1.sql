-- الفريق الكشفي: أعضاؤه من كل الفصول، يضيفهم ويحذفهم من له صلاحية «الفريق الكشفي»
-- (مثل القائد الكشفي في «الأدوار المخصّصة»)، والمدير والدعم الفني دائمًا.

create table if not exists public.scout_members (
  student_id    uuid primary key references public.students(id) on delete cascade,
  added_by      uuid default auth.uid(),
  added_by_name text,
  added_at      timestamptz not null default now()
);
alter table public.scout_members enable row level security;

drop policy if exists scout_members_read on public.scout_members;
create policy scout_members_read on public.scout_members for select to authenticated
  using (public.has_permission('scouts') or public.is_admin());

drop policy if exists scout_members_write on public.scout_members;
create policy scout_members_write on public.scout_members for all to authenticated
  using (public.has_permission('scouts'))
  with check (public.has_permission('scouts'));

-- للتحقق
select count(*) as scout_members from public.scout_members;
-- نهاية الجزء 1
