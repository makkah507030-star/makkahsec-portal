-- =====================================================================
-- التطوير المهني (الجزء 1 من 4): الأقسام الدراسية ورؤساؤها وأعضاؤها.
--
-- • departments: الأقسام كما في «رؤساء الأقسام بمدرسة مكة الثانوية».
-- • department_members: معلمو كل قسم، و is_head لرئيس القسم.
-- • my_department(): قسم المستخدم الحالي ودوره فيه (للوسم «رئيس قسم …»).
-- الإدارة (المدير والدعم الفني ووكيل الشؤون التعليمية) تعدّل الأعضاء.
-- يُنفَّذ قبل الأجزاء 2 و3 و4. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0
);

create table if not exists public.department_members (
  department_id uuid not null references public.departments(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  is_head boolean not null default false,
  primary key (department_id, teacher_id)
);
-- رئيس واحد لكل قسم، والمعلم في قسم واحد
create unique index if not exists department_one_head on public.department_members (department_id) where is_head;
create unique index if not exists department_one_per_teacher on public.department_members (teacher_id);

alter table public.departments enable row level security;
alter table public.department_members enable row level security;

drop policy if exists departments_read on public.departments;
create policy departments_read on public.departments for select to authenticated using (true);
drop policy if exists department_members_read on public.department_members;
create policy department_members_read on public.department_members for select to authenticated using (true);

drop policy if exists departments_manage on public.departments;
create policy departments_manage on public.departments for all to authenticated
  using (public.has_admin_role(array['principal', 'tech_support', 'deputy_academic']))
  with check (public.has_admin_role(array['principal', 'tech_support', 'deputy_academic']));
drop policy if exists department_members_manage on public.department_members;
create policy department_members_manage on public.department_members for all to authenticated
  using (public.has_admin_role(array['principal', 'tech_support', 'deputy_academic']))
  with check (public.has_admin_role(array['principal', 'tech_support', 'deputy_academic']));

create or replace function public.my_department()
returns table (department_id uuid, department_name text, is_head boolean)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.name, m.is_head
    from department_members m
    join departments d on d.id = m.department_id
    join teachers t on t.id = m.teacher_id
   where t.user_id = auth.uid()
   limit 1;
$$;

revoke execute on function public.my_department() from public, anon;
grant  execute on function public.my_department() to authenticated;

insert into public.departments (name, sort_order) values
  ('الدراسات الإسلامية', 1),
  ('اللغة العربية ومصادر البحث والمعلومات', 2),
  ('اللغة الإنجليزية', 3),
  ('الأحياء', 4),
  ('الكيمياء', 5),
  ('الفيزياء', 6),
  ('الرياضيات', 7),
  ('الدراسات الاجتماعية', 8),
  ('التقنية الرقمية والعلوم الإدارية والنفسية', 9),
  ('التربية البدنية', 10)
on conflict (name) do update set sort_order = excluded.sort_order;
-- نهاية الجزء 1
