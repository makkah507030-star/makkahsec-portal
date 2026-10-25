-- =====================================================================
-- مركز التحصيل: لجنة التحصيل الدراسي برئاسة وكيل الشؤون التعليمية، ومحاضر اجتماعاتها.
-- يختار الوكيل أعضاءها من المعلمين والإداريين بصفاتهم، فيرون المركز وتقاريره ونماذجه
-- للاطلاع، ويكتب المقرر المحاضر. يُنفَّذ بعد ach_forms_1.sql. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.ach_committee (
  user_id uuid primary key references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('secretary', 'member')),
  title text,                                   -- صفته: معلم رياضيات، موجه طلابي…
  added_by_name text, added_at timestamptz not null default now()
);
create table if not exists public.ach_meetings (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  held_on date not null default current_date,
  title text not null,
  agenda text,
  attendees uuid[] not null default '{}',
  decisions jsonb not null default '[]',        -- [{ text, owner, due, done }]
  notes text,
  created_by_name text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function public.ach_is_member() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from ach_committee where user_id = auth.uid());
$$;
create or replace function public.ach_can_minute() returns boolean language sql stable security definer set search_path = public as $$
  select public.ach_can_decide() or exists (select 1 from ach_committee where user_id = auth.uid() and role = 'secretary');
$$;
-- أعضاء اللجنة يرون نماذج الملاحظة وتقاريرها للاطلاع، ودرجات إشعار الفترة للتحليل
create or replace function public.ach_can_grade(p_grade int) returns boolean language sql stable security definer set search_path = public as $$
  select public.ach_all() or public.has_admin_role(array['counselor_' || p_grade]) or public.ach_is_member();
$$;
drop policy if exists period_notices_ach on public.period_notices;
create policy period_notices_ach on public.period_notices for select to authenticated using (public.ach_is_member());

alter table public.ach_committee enable row level security;
alter table public.ach_meetings enable row level security;
drop policy if exists ach_committee_read on public.ach_committee;
create policy ach_committee_read on public.ach_committee for select to authenticated using (public.ach_all() or public.ach_is_member());
drop policy if exists ach_committee_write on public.ach_committee;
create policy ach_committee_write on public.ach_committee for all to authenticated
  using (public.ach_can_decide()) with check (public.ach_can_decide());
drop policy if exists ach_meetings_read on public.ach_meetings;
create policy ach_meetings_read on public.ach_meetings for select to authenticated using (public.ach_all() or public.ach_is_member());
drop policy if exists ach_meetings_write on public.ach_meetings;
create policy ach_meetings_write on public.ach_meetings for all to authenticated
  using (public.ach_can_minute()) with check (public.ach_can_minute());
grant select, insert, update, delete on public.ach_committee, public.ach_meetings to authenticated;

-- أسماء الأعضاء وصفاتهم (جدول المستخدمين لا يقرؤه المعلم)
create or replace function public.ach_committee_list()
returns table (user_id uuid, full_name text, role text, title text, user_role text)
language sql stable security definer set search_path = public as $$
  select c.user_id, u.full_name, c.role, c.title, u.role::text from ach_committee c join users u on u.id = c.user_id
  where public.ach_all() or public.ach_is_member();
$$;
revoke all on function public.ach_is_member(), public.ach_can_minute(), public.ach_committee_list() from public, anon;
grant execute on function public.ach_is_member(), public.ach_can_minute(), public.ach_committee_list() to authenticated;

-- نهاية الجزء 1
