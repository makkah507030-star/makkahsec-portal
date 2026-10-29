-- =====================================================================
-- قسم التقويم والاعتماد المدرسي (3): الشواهد في مخزن خاص، ومحاضر لجنة التميز،
-- وخطوات التقويم الذاتي والخارجي، وتنظيم أدوات التقويم. يُنفَّذ بعد acc_2.sql.
-- مسار الملف في المخزن: <الرمز>/<ملف> للشواهد، وreports/<ملف> للتقارير والمحاضر.
-- =====================================================================

create table if not exists public.acc_evidence (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[1-4]-[0-9]-[0-9]-[0-9]$'),
  domain int generated always as (substr(code, 1, 1)::int) stored,
  academic_year text not null,
  title text not null,
  file_path text, link text,
  tool text,                                     -- أداة التقويم التي يخدمها الشاهد
  status text not null default 'collected' check (status in ('collected', 'reviewed', 'approved')),
  notes text,
  created_by uuid default auth.uid(), created_by_name text, created_at timestamptz not null default now()
);
create index if not exists acc_evidence_code on public.acc_evidence (code);
alter table public.acc_evidence enable row level security;
drop policy if exists acc_evidence_read on public.acc_evidence;
create policy acc_evidence_read on public.acc_evidence for select to authenticated using (public.acc_domain(domain));
drop policy if exists acc_evidence_add on public.acc_evidence;
create policy acc_evidence_add on public.acc_evidence for insert to authenticated with check (public.acc_domain(domain));
-- التعديل والحذف لصاحب الشاهد في مجاله، والاعتماد للمشرف
drop policy if exists acc_evidence_edit on public.acc_evidence;
create policy acc_evidence_edit on public.acc_evidence for update to authenticated
  using (public.acc_coord() or (created_by = auth.uid() and public.acc_domain(domain)))
  with check (public.acc_coord() or (status <> 'approved' and public.acc_domain(domain)));
drop policy if exists acc_evidence_del on public.acc_evidence;
create policy acc_evidence_del on public.acc_evidence for delete to authenticated
  using (public.acc_coord() or (created_by = auth.uid() and status <> 'approved'));
grant select, insert, update, delete on public.acc_evidence to authenticated;

-- المخزن الخاص: حتى 25 ميجا للملف
insert into storage.buckets (id, name, public, file_size_limit)
values ('accreditation', 'accreditation', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
create or replace function public.acc_can_file(p_name text) returns boolean language sql stable security definer set search_path = public as $$
  select case when p_name like 'reports/%' then public.acc_member()
              when p_name ~ '^[1-4]-' then public.acc_domain(substr(p_name, 1, 1)::int) else false end;
$$;
drop policy if exists "acc files read" on storage.objects;
create policy "acc files read" on storage.objects for select to authenticated
  using (bucket_id = 'accreditation' and public.acc_can_file(name));
drop policy if exists "acc files write" on storage.objects;
create policy "acc files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'accreditation' and public.acc_can_file(name) and (name not like 'reports/%' or public.acc_coord()));
drop policy if exists "acc files delete" on storage.objects;
create policy "acc files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'accreditation' and (public.acc_coord() or (owner = auth.uid() and public.acc_can_file(name))));

-- محاضر لجنة التميز
create table if not exists public.acc_meetings (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  held_on date not null default current_date,
  title text not null,
  agenda text,
  attendees uuid[] not null default '{}',
  decisions jsonb not null default '[]',         -- [{ text, owner, due, done }]
  notes text,
  created_by_name text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- خطوات التقويم الذاتي والخارجي (PHASES في src/lib/accreditation.js)، وأدوات التقويم (TOOLS)
create table if not exists public.acc_steps (
  academic_year text not null, kind text not null check (kind in ('self', 'external')), step text not null,
  done_at timestamptz, done_by_name text, note text,
  primary key (academic_year, kind, step)
);
create table if not exists public.acc_tools (
  academic_year text not null, tool text not null,
  owner_name text, due date,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  target int, done int, notes text,
  primary key (academic_year, tool)
);
alter table public.acc_meetings enable row level security;
alter table public.acc_steps enable row level security;
alter table public.acc_tools enable row level security;
drop policy if exists acc_meetings_read on public.acc_meetings;
create policy acc_meetings_read on public.acc_meetings for select to authenticated using (public.acc_member());
drop policy if exists acc_meetings_write on public.acc_meetings;
create policy acc_meetings_write on public.acc_meetings for all to authenticated using (public.acc_coord()) with check (public.acc_coord());
drop policy if exists acc_steps_read on public.acc_steps;
create policy acc_steps_read on public.acc_steps for select to authenticated using (public.acc_member());
drop policy if exists acc_steps_write on public.acc_steps;
create policy acc_steps_write on public.acc_steps for all to authenticated using (public.acc_coord()) with check (public.acc_coord());
drop policy if exists acc_tools_read on public.acc_tools;
create policy acc_tools_read on public.acc_tools for select to authenticated using (public.acc_member());
drop policy if exists acc_tools_write on public.acc_tools;
create policy acc_tools_write on public.acc_tools for all to authenticated using (public.acc_coord()) with check (public.acc_coord());
grant select, insert, update, delete on public.acc_meetings, public.acc_steps, public.acc_tools to authenticated;
revoke all on function public.acc_can_file(text) from public, anon;
grant execute on function public.acc_can_file(text) to authenticated;

-- نهاية الجزء 3
