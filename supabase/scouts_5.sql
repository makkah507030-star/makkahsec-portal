-- =====================================================================
-- الفريق الكشفي (الجزء 5): الهيكل والطلائع. يُنفَّذ بعد scouts_4.sql.
-- • scout_staff: القائد الكشفي ونائبه (كل دور مخصّص في اسمه «كشف») ومن له صلاحية
--   «الفريق الكشفي»؛ ويديرون الهيكل والتحضير والتقييم والبلاغات.
-- • الهيكل: القائد ← النائب ← العريف الأول ← نائب العريف الأول ← عرفاء الطلائع، ولكل
--   طليعة عريف ونائب عريف وأعضاء ومهام.
-- • can_attend: صلاحية العريف في تحضير طليعته (يسحبها القائد).
-- • اسم الطليعة يختاره القائد ونائبه، وعريفها من حسابه (scout_patrol_rename).
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.scout_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_permission('scouts') or exists (
    select 1 from admin_roles r join custom_roles c on c.role_type = r.role_type
      join users u on u.id = r.user_id and u.is_active
     where r.user_id = auth.uid() and c.label like '%كشف%');
$$;

-- القائد ونائبه بأسمائهم (لرأس الهيكل)
create or replace function public.scout_staff_list() returns table (full_name text, label text, deputy boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(t.full_name), ''), u.full_name), c.label, c.label like '%نائب%'
    from custom_roles c join admin_roles r on r.role_type = c.role_type
    join users u on u.id = r.user_id and u.is_active left join teachers t on t.user_id = u.id
   where c.label like '%كشف%' and (public.scout_staff() or public.is_admin())
   order by c.label like '%نائب%', u.full_name;
$$;

create table if not exists public.scout_patrols (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  motto text,                                   -- شعار الطليعة
  tasks text,                                   -- مهامها: سطر لكل مهمة
  color text not null default '#3E8A62',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.scout_members add column if not exists post text not null default 'member';
alter table public.scout_members add column if not exists patrol_id uuid references public.scout_patrols(id) on delete set null;
alter table public.scout_members add column if not exists can_attend boolean not null default true;
alter table public.scout_members drop constraint if exists scout_members_post_check;
alter table public.scout_members add constraint scout_members_post_check check (
  post in ('chief', 'chief_deputy', 'patrol_leader', 'patrol_deputy', 'member')
  and (post not in ('patrol_leader', 'patrol_deputy') or patrol_id is not null)
  and (post not in ('chief', 'chief_deputy') or patrol_id is null));
create unique index if not exists scout_members_one_chief on public.scout_members (post) where post in ('chief', 'chief_deputy');
create unique index if not exists scout_members_one_patrol_post on public.scout_members (patrol_id, post)
  where post in ('patrol_leader', 'patrol_deputy');

-- حذف الطليعة: يعود عريفها ونائبه وأعضاؤها أعضاءً بلا طليعة
create or replace function public.scout_patrol_del() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update scout_members set post = 'member', patrol_id = null where patrol_id = old.id;
  return old;
end $$;
drop trigger if exists scout_patrol_del on public.scout_patrols;
create trigger scout_patrol_del before delete on public.scout_patrols for each row execute function public.scout_patrol_del();

-- إدارة الأعضاء والطلائع للقائد ونائبه ومن له الصلاحية
drop policy if exists scout_members_read on public.scout_members;
create policy scout_members_read on public.scout_members for select to authenticated
  using (public.scout_staff() or public.is_admin());
drop policy if exists scout_members_write on public.scout_members;
create policy scout_members_write on public.scout_members for all to authenticated
  using (public.scout_staff()) with check (public.scout_staff());

alter table public.scout_patrols enable row level security;
drop policy if exists scout_patrols_read on public.scout_patrols;
create policy scout_patrols_read on public.scout_patrols for select to authenticated
  using (public.scout_staff() or public.is_admin());
drop policy if exists scout_patrols_write on public.scout_patrols;
create policy scout_patrols_write on public.scout_patrols for all to authenticated
  using (public.scout_staff()) with check (public.scout_staff());

-- عريف الطليعة يختار اسم طليعته من حسابه (والقائد ونائبه من صفحة الفريق)
create or replace function public.scout_patrol_rename(p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_name, ''))) not between 2 and 40 then raise exception 'اكتب اسم الطليعة (2 إلى 40 حرفًا)'; end if;
  update scout_patrols set name = trim(p_name) where id = (select sm.patrol_id from scout_members sm join students s on s.id = sm.student_id
     where s.user_id = auth.uid() and sm.post = 'patrol_leader' limit 1);
  if not found then raise exception 'تسمية الطليعة لعريفها'; end if;
end $$;

revoke all on function public.scout_staff(), public.scout_staff_list(), public.scout_patrol_rename(text) from public, anon;
grant execute on function public.scout_staff(), public.scout_staff_list(), public.scout_patrol_rename(text) to authenticated;

-- للتحقق
select (select count(*) from public.scout_members) as "الأعضاء",
       (select count(*) from public.scout_patrols) as "الطلائع",
       public.scout_staff() as "لك إدارة الفريق";
-- نهاية الجزء 5
