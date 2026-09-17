-- ============================================================
-- وضع الصيانة — حجب البوابة عن الجميع ما عدا الدعم الفني
-- ============================================================

create table if not exists public.maintenance_state (
  id int primary key default 1 check (id = 1),
  is_enabled boolean not null default false,
  message text,
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now()
);

-- صف واحد ثابت فقط
insert into public.maintenance_state (id, is_enabled, message)
values (1, false, null)
on conflict (id) do nothing;

alter table public.maintenance_state enable row level security;

-- أي مستخدم مسجّل دخول يقرأ الحالة (ليعرف هل البوابة محجوبة)
create policy ms_read on public.maintenance_state
  for select
  using (auth.uid() is not null);

-- الدعم الفني فقط (role_type = tech_support) يبدّل الحالة أو يعدّل الرسالة
create policy ms_write on public.maintenance_state
  for update
  using (
    exists (
      select 1 from public.admin_roles ar
      join public.users u on u.id = ar.user_id
      where ar.user_id = auth.uid() and ar.role_type = 'tech_support' and u.is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.admin_roles ar
      join public.users u on u.id = ar.user_id
      where ar.user_id = auth.uid() and ar.role_type = 'tech_support' and u.is_active = true
    )
  );
