-- =====================================================================
-- الثقافة المؤسسية — سفير الثقافة (1): الفريق والصلاحيات.
-- • سفير الثقافة: يدير القسم كله (الخطة والتنفيذ والتواصل والمناسبات والتهيئة والأفكار).
-- • المدير والوكلاء والدعم الفني: يرون القسم كله ويديرونه، ويعيّنون السفير.
-- • عضو الفريق: يرى القسم ويوثّق التنفيذ. • كل الموظفين: القيم ومشاركة الأفكار.
-- يُسند السفير هنا إلى الأستاذ زياد الحربي. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.cult_team (
  user_id uuid primary key references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('ambassador', 'member')),
  added_by_name text, added_at timestamptz not null default now()
);

create or replace function public.cult_all() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['principal', 'deputy_academic', 'deputy_school', 'deputy_students', 'tech_support']);
$$;
create or replace function public.cult_amb() returns boolean language sql stable security definer set search_path = public as $$
  select public.cult_all() or exists (select 1 from cult_team where user_id = auth.uid() and role = 'ambassador');
$$;
create or replace function public.cult_member() returns boolean language sql stable security definer set search_path = public as $$
  select public.cult_amb() or exists (select 1 from cult_team where user_id = auth.uid());
$$;
-- الموظف: معلم أو إداري نشط
create or replace function public.cult_staff_user() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from users where id = auth.uid() and is_active and role::text in ('teacher', 'admin'));
$$;

-- تعيين السفير أو عزله للمدير والوكلاء والدعم الفني، وإضافة الأعضاء للسفير
create or replace function public.cult_team_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() فارغ في محرر SQL (تعيين السفير في هذا الملف)
  if auth.uid() is not null and not public.cult_all() and ((tg_op <> 'INSERT' and old.role = 'ambassador') or (tg_op <> 'DELETE' and new.role = 'ambassador')) then
    raise exception 'تعيين سفير الثقافة لمدير المدرسة والوكلاء';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists cult_team_guard on public.cult_team;
create trigger cult_team_guard before insert or update or delete on public.cult_team for each row execute function public.cult_team_guard();

alter table public.cult_team enable row level security;
drop policy if exists cult_team_read on public.cult_team;
create policy cult_team_read on public.cult_team for select to authenticated using (public.cult_member());
drop policy if exists cult_team_write on public.cult_team;
create policy cult_team_write on public.cult_team for all to authenticated using (public.cult_amb()) with check (public.cult_amb());
grant select, insert, update, delete on public.cult_team to authenticated;

-- صلاحيتي: { all, amb, member, staff }
create or replace function public.cult_me() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('all', public.cult_all(), 'amb', public.cult_amb(), 'member', public.cult_member(), 'staff', public.cult_staff_user());
$$;
-- الفريق بأسمائه، والموظفون (للمناسبات والتهيئة واختيار الأعضاء)
create or replace function public.cult_team_list() returns table (user_id uuid, full_name text, role text)
language sql stable security definer set search_path = public as $$
  select t.user_id, u.full_name, t.role from cult_team t join users u on u.id = t.user_id where public.cult_member();
$$;
create or replace function public.cult_staff() returns table (id uuid, full_name text)
language sql stable security definer set search_path = public as $$
  select u.id, u.full_name from users u
   where public.cult_member() and u.is_active and u.role::text in ('teacher', 'admin') and u.full_name is not null
   order by u.full_name;
$$;

revoke all on function public.cult_all(), public.cult_amb(), public.cult_member(), public.cult_staff_user(), public.cult_me(),
  public.cult_team_list(), public.cult_staff() from public, anon;
grant execute on function public.cult_all(), public.cult_amb(), public.cult_member(), public.cult_staff_user(), public.cult_me(),
  public.cult_team_list(), public.cult_staff() to authenticated;

-- سفير الثقافة: الأستاذ زياد الحربي (إن لم يُعيَّن سفير)
insert into public.cult_team (user_id, role, added_by_name)
select u.id, 'ambassador', 'مدير المدرسة' from public.users u
 where u.full_name like '%زياد%' and u.full_name like '%الحربي%' and u.is_active and u.role::text in ('teacher', 'admin')
   and not exists (select 1 from public.cult_team where role = 'ambassador')
 order by u.full_name limit 1
on conflict (user_id) do update set role = 'ambassador';

-- نهاية الجزء 1
