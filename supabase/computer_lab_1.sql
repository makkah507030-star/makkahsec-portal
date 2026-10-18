-- =====================================================================
-- معمل الحاسب الآلي (1 من 2): المعامل والأجهزة والحجوزات وصلاحياتها
-- الحجز لمعلمي التقنية الرقمية المخوّلين من «صلاحيات المعلمين»، والإدارة
-- لمحضر معمل الحاسب الآلي ومدير المدرسة والدعم الفني. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.labs (
  id smallint primary key,
  name text not null,
  is_active boolean not null default true
);
insert into public.labs (id, name, is_active) values
  (1, 'معمل الحاسب الآلي 1', true), (2, 'معمل الحاسب الآلي 2', false)
on conflict (id) do nothing;

create table if not exists public.lab_devices (
  id uuid primary key default gen_random_uuid(),
  lab_id smallint not null references public.labs(id),
  seat_no integer not null,
  code text not null,
  status text not null default 'ok' check (status in ('ok', 'broken', 'maintenance')),
  cpu text, ram text, storage text, os text, software text, serial_no text, notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (lab_id, seat_no), unique (lab_id, code)
);
-- 24 جهازًا للمعمل الأول (شكل U)
insert into public.lab_devices (lab_id, seat_no, code)
select 1, g, 'PC-' || lpad(g::text, 2, '0') from generate_series(1, 24) g
on conflict do nothing;

create table if not exists public.lab_bookings (
  id uuid primary key default gen_random_uuid(),
  lab_id smallint not null references public.labs(id),
  booking_date date not null,
  period_no integer not null check (period_no between 1 and 8),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  lesson text,
  series_id uuid,
  created_at timestamptz not null default now(),
  -- لا يجتمع حجزان على الحصة نفسها في المعمل نفسه
  unique (lab_id, booking_date, period_no)
);
create index if not exists lab_bookings_teacher on public.lab_bookings (teacher_id, booking_date);

-- تبويب «معمل الحاسب الآلي» ضمن الصلاحيات الإضافية للمعلمين
alter table public.teacher_granted_tabs drop constraint if exists teacher_granted_tabs_tab_key_check;
alter table public.teacher_granted_tabs add constraint teacher_granted_tabs_tab_key_check
  check (tab_key = any (array['permissions', 'news', 'computer_lab']));

-- مسؤولو المعمل
create or replace function public.lab_is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_any_admin_role(array['computer_lab', 'principal', 'tech_support']::admin_role_type[]);
$$;
-- المعلم المخوّل بالحجز
create or replace function public.lab_can_book() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teacher_granted_tabs g
                  where g.teacher_id = public.current_teacher_id() and g.tab_key = 'computer_lab');
$$;
-- منسوبو المدرسة (إداري أو معلم) يرون المعمل وأجهزته وحجوزاته
create or replace function public.lab_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role()::text in ('admin', 'teacher'), false);
$$;
revoke execute on function public.lab_is_manager(), public.lab_can_book(), public.lab_is_staff() from public, anon;
grant  execute on function public.lab_is_manager(), public.lab_can_book(), public.lab_is_staff() to authenticated;

alter table public.labs enable row level security;
alter table public.lab_devices enable row level security;
alter table public.lab_bookings enable row level security;

drop policy if exists "labs read" on public.labs;
create policy "labs read" on public.labs for select to authenticated using (public.lab_is_staff());

drop policy if exists "lab devices read" on public.lab_devices;
create policy "lab devices read" on public.lab_devices for select to authenticated using (public.lab_is_staff());
drop policy if exists "lab devices manage" on public.lab_devices;
create policy "lab devices manage" on public.lab_devices for all to authenticated
  using (public.lab_is_manager()) with check (public.lab_is_manager());

-- الحجوزات: قراءة فقط، والإضافة والإلغاء عبر الدالتين في الجزء 2
drop policy if exists "lab bookings read" on public.lab_bookings;
create policy "lab bookings read" on public.lab_bookings for select to authenticated using (public.lab_is_staff());
-- نهاية الجزء 1
