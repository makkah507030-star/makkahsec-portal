-- مختبرات العلوم (1 من 6): المختبرات الثلاثة، والخطة الفصلية للتجارب (و.م.ع.ن-08-03)، وحجز المختبر،
-- وسجل تنفيذ التجارب (و.م.ع.ن-08-04)، والعهدة. يديرها محضر كل مختبر ومدير المدرسة والدعم الفني ووكيل
-- الشؤون المدرسية، ويحجز معلم المادة بحسب تخصصه أو جدوله. تكرار التنفيذ آمن.
create table if not exists public.sci_labs (
  key text primary key, name text not null, role_type text not null, pattern text not null, sort smallint not null default 0);
insert into public.sci_labs values ('bio', 'مختبر الأحياء', 'science_labs', 'أحياء|احياء', 1),
  ('chem', 'مختبر الكيمياء', 'science_labs_3', 'كيمياء', 2), ('phys', 'مختبر الفيزياء', 'science_labs_2', 'فيزياء', 3)
on conflict (key) do update set name = excluded.name, role_type = excluded.role_type, pattern = excluded.pattern, sort = excluded.sort;

create table if not exists public.sci_experiments (
  id bigint generated always as identity primary key, lab text not null references public.sci_labs(key),
  course text not null, grade smallint not null, no smallint not null, chapter text, chapter_title text, title text not null,
  kind text not null default 'main' check (kind in ('launch', 'main', 'lab')), guide boolean not null default false,
  page int, guide_page int, week smallint check (week between 1 and 20), tools text,
  is_active boolean not null default true, unique (course, no));

create table if not exists public.sci_bookings (
  id uuid primary key default gen_random_uuid(), lab text not null references public.sci_labs(key),
  booking_date date not null, period_no int not null check (period_no between 1 and 8),
  teacher_id uuid not null references public.teachers(id) on delete cascade, class_id uuid references public.classes(id) on delete set null,
  experiment_id bigint references public.sci_experiments(id) on delete set null, note text,
  prep text not null default 'pending' check (prep in ('pending', 'ready', 'issue')), prep_note text, prep_at timestamptz,
  created_at timestamptz not null default now(), unique (lab, booking_date, period_no));

create table if not exists public.sci_runs (
  id uuid primary key default gen_random_uuid(), academic_year text not null,
  experiment_id bigint not null references public.sci_experiments(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade, run_date date not null default current_date,
  outcome text not null check (outcome in ('lab', 'virtual', 'not_done')),
  reason text check (reason in ('materials', 'prep', 'teacher', 'other')), reason_note text,
  confirmed_at timestamptz, confirmed_by_name text, created_at timestamptz not null default now(),
  unique (academic_year, experiment_id, class_id));

create table if not exists public.sci_inventory (
  id bigint generated always as identity primary key, lab text not null references public.sci_labs(key),
  name text not null, kind text not null default 'tool' check (kind in ('device', 'tool', 'chemical', 'other')),
  qty numeric not null default 1, unit text, status text not null default 'ok' check (status in ('ok', 'damaged', 'missing')),
  expiry date, location text, note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

-- من يدير المختبر: محضره، ومدير المدرسة والدعم الفني ووكيل الشؤون المدرسية
create or replace function public.sci_manager(p_lab text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['principal', 'tech_support', 'deputy_school'])
      or exists (select 1 from sci_labs l join admin_roles r on r.role_type::text = l.role_type
                  where l.key = p_lab and r.user_id = auth.uid());
$$;
-- مختبرات المعلم: بتخصصه، أو بمواد جدوله في العام النشط
create or replace function public.sci_teacher_labs(p_uid uuid default auth.uid()) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct l.key), '{}') from sci_labs l join teachers t on t.user_id = p_uid and t.is_active
   where coalesce(t.specialization, '') ~ l.pattern
      or exists (select 1 from schedule s join subjects b on b.id = s.subject_id where s.teacher_id = t.id
                   and s.academic_year = (select value from settings where key = 'active_year') and b.name ~ l.pattern);
$$;
create or replace function public.sci_my_teacher() returns uuid
language sql stable security definer set search_path = public as $$ select id from teachers where user_id = auth.uid() and is_active limit 1; $$;
create or replace function public.sci_can_see(p_lab text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.sci_manager(p_lab) or p_lab = any(public.sci_teacher_labs()); $$;
grant execute on function public.sci_manager(text), public.sci_teacher_labs(uuid), public.sci_my_teacher(), public.sci_can_see(text) to authenticated;

alter table public.sci_labs enable row level security;
alter table public.sci_experiments enable row level security;
alter table public.sci_bookings enable row level security;
alter table public.sci_runs enable row level security;
alter table public.sci_inventory enable row level security;
drop policy if exists sci_labs_r on public.sci_labs;
create policy sci_labs_r on public.sci_labs for select to authenticated using (true);
drop policy if exists sci_exp_r on public.sci_experiments;
create policy sci_exp_r on public.sci_experiments for select to authenticated using (public.sci_can_see(lab));
drop policy if exists sci_exp_w on public.sci_experiments;
create policy sci_exp_w on public.sci_experiments for all to authenticated using (public.sci_manager(lab)) with check (public.sci_manager(lab));
drop policy if exists sci_inv_r on public.sci_inventory;
create policy sci_inv_r on public.sci_inventory for select to authenticated using (public.sci_can_see(lab));
drop policy if exists sci_inv_w on public.sci_inventory;
create policy sci_inv_w on public.sci_inventory for all to authenticated using (public.sci_manager(lab)) with check (public.sci_manager(lab));
-- الحجز: يراه المختبر كله، ويحجز المعلم لنفسه في مختبر مادته، ويعدّل المحضر حالة التجهيز
drop policy if exists sci_bk_r on public.sci_bookings;
create policy sci_bk_r on public.sci_bookings for select to authenticated using (public.sci_can_see(lab));
drop policy if exists sci_bk_i on public.sci_bookings;
create policy sci_bk_i on public.sci_bookings for insert to authenticated with check (public.sci_manager(lab)
  or (teacher_id = public.sci_my_teacher() and lab = any(public.sci_teacher_labs()) and booking_date >= current_date));
drop policy if exists sci_bk_u on public.sci_bookings;
create policy sci_bk_u on public.sci_bookings for update to authenticated using (public.sci_manager(lab) or teacher_id = public.sci_my_teacher());
drop policy if exists sci_bk_d on public.sci_bookings;
create policy sci_bk_d on public.sci_bookings for delete to authenticated using (public.sci_manager(lab) or teacher_id = public.sci_my_teacher());
-- سجل التنفيذ: يسجّل المعلم تجارب فصوله، ويعتمدها المحضر
drop policy if exists sci_run_r on public.sci_runs;
create policy sci_run_r on public.sci_runs for select to authenticated
  using (public.sci_can_see((select lab from public.sci_experiments e where e.id = experiment_id)));
drop policy if exists sci_run_w on public.sci_runs;
create policy sci_run_w on public.sci_runs for all to authenticated
  using (teacher_id = public.sci_my_teacher() or public.sci_manager((select lab from public.sci_experiments e where e.id = experiment_id)))
  with check (teacher_id = public.sci_my_teacher() or public.sci_manager((select lab from public.sci_experiments e where e.id = experiment_id)));
grant select on public.sci_labs to authenticated;
grant select, insert, update, delete on public.sci_experiments, public.sci_bookings, public.sci_runs, public.sci_inventory to authenticated;
-- نهاية الجزء 1
