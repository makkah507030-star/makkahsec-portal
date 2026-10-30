-- =====================================================================
-- قسم التقويم والاعتماد المدرسي (1): لجنة التميز وصلاحياتها والتقارير المرفوعة.
-- • المدير ووكيل الشؤون التعليمية والدعم الفني: يرون كل القسم ويديرونه، ويعيّنون المشرف.
-- • مشرف اللجنة: يرى كل القسم، ويضيف الأعضاء ويسند لكل عضو مجالات من المجالات الأربعة.
-- • العضو: يرى مؤشرات مجالاته وبرامجها وشواهدها فقط، ويعمل عليها.
-- تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.acc_members (
  user_id uuid primary key references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('coordinator', 'member')),
  title text,                                    -- صفته: معلم متميز، الموجه الطلابي…
  domains int[] not null default '{}',           -- المجالات المسندة إليه (1–4)
  added_by_name text, added_at timestamptz not null default now()
);

create or replace function public.acc_all() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['principal', 'deputy_academic', 'tech_support']);
$$;
create or replace function public.acc_coord() returns boolean language sql stable security definer set search_path = public as $$
  select public.acc_all() or exists (select 1 from acc_members where user_id = auth.uid() and role = 'coordinator');
$$;
create or replace function public.acc_member() returns boolean language sql stable security definer set search_path = public as $$
  select public.acc_all() or exists (select 1 from acc_members where user_id = auth.uid());
$$;
create or replace function public.acc_domain(p_domain int) returns boolean language sql stable security definer set search_path = public as $$
  select public.acc_coord() or exists (select 1 from acc_members where user_id = auth.uid() and p_domain = any(domains));
$$;

-- المشرف يدير الأعضاء، وتعيين المشرف أو عزله للمدير والوكيل والدعم الفني وحدهم
create or replace function public.acc_members_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.acc_all() and ((tg_op <> 'INSERT' and old.role = 'coordinator') or (tg_op <> 'DELETE' and new.role = 'coordinator')) then
    raise exception 'تعيين مشرف اللجنة للمدير ووكيل الشؤون التعليمية';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists acc_members_guard on public.acc_members;
create trigger acc_members_guard before insert or update or delete on public.acc_members
  for each row execute function public.acc_members_guard();

alter table public.acc_members enable row level security;
drop policy if exists acc_members_read on public.acc_members;
create policy acc_members_read on public.acc_members for select to authenticated using (public.acc_member());
drop policy if exists acc_members_write on public.acc_members;
create policy acc_members_write on public.acc_members for all to authenticated using (public.acc_coord()) with check (public.acc_coord());
grant select, insert, update, delete on public.acc_members to authenticated;

-- صلاحيتي: { all, coord, member, domains }
create or replace function public.acc_me() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('all', public.acc_all(), 'coord', public.acc_coord(), 'member', public.acc_member(),
    'domains', coalesce((select to_jsonb(domains) from acc_members where user_id = auth.uid()), '[]'::jsonb));
$$;
-- الأعضاء بأسمائهم، والمنسوبون لاختيار الأعضاء (جدول المستخدمين لا يقرؤه المعلم)
create or replace function public.acc_members_list()
returns table (user_id uuid, full_name text, role text, title text, domains int[])
language sql stable security definer set search_path = public as $$
  select m.user_id, u.full_name, m.role, m.title, m.domains from acc_members m join users u on u.id = m.user_id
  where public.acc_member();
$$;
create or replace function public.acc_staff() returns table (id uuid, full_name text)
language sql stable security definer set search_path = public as $$
  select u.id, u.full_name from users u
  where public.acc_coord() and u.is_active and u.role::text in ('teacher', 'admin') and u.full_name is not null;
$$;

-- التقارير المرفوعة: التقويم الذاتي، والتقويم الخارجي بعد الزيارة، وخطة التحسين المرفوعة.
-- scores: نسب المؤشرات { "1-1-1-1": 75.25, … } يُدخلها المشرف من التقرير فيُحلَّل في البوابة.
create table if not exists public.acc_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('self', 'external', 'plan')),
  academic_year text not null,
  title text not null,
  file_path text,
  report_date date,
  scores jsonb not null default '{}',
  notes text,
  created_by_name text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.acc_reports enable row level security;
drop policy if exists acc_reports_read on public.acc_reports;
create policy acc_reports_read on public.acc_reports for select to authenticated using (public.acc_member());
drop policy if exists acc_reports_write on public.acc_reports;
create policy acc_reports_write on public.acc_reports for all to authenticated using (public.acc_coord()) with check (public.acc_coord());
grant select, insert, update, delete on public.acc_reports to authenticated;

revoke all on function public.acc_all(), public.acc_coord(), public.acc_member(), public.acc_domain(int),
  public.acc_me(), public.acc_members_list(), public.acc_staff() from public, anon;
grant execute on function public.acc_all(), public.acc_coord(), public.acc_member(), public.acc_domain(int),
  public.acc_me(), public.acc_members_list(), public.acc_staff() to authenticated;

-- نهاية الجزء 1
