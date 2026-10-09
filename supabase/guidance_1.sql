-- =====================================================================
-- التوجيه الطلابي — الجزء 1 من 2: سجل الحالات الإرشادية (سري).
-- كل صف مرتبط بموجهه: counselor_1 للصف الأول، counselor_2 للثاني، counselor_3
-- للثالث. يرى الموجه حالات صفه وحده، ويرى وكيل شؤون الطلاب ومدير المدرسة الجميع.
-- تكرار التنفيذ آمن.
-- =====================================================================

-- هل يطّلع المستخدم على عمل التوجيه لهذا الصف؟
create or replace function public.guidance_can(p_grade int)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['principal', 'deputy_students'])
      or public.has_admin_role(array['counselor_' || p_grade]);
$$;
revoke execute on function public.guidance_can(int) from public, anon;
grant  execute on function public.guidance_can(int) to authenticated;

create table if not exists public.guidance_cases (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  grade int not null check (grade between 1 and 3),
  source text not null default 'warning'
    check (source in ('warning', 'referral', 'guardian', 'student', 'teacher', 'other')),
  title text not null check (length(trim(title)) > 0),     -- المشكلة باختصار
  details text,                                             -- أسباب الرصد ووصف الحالة
  status text not null default 'open' check (status in ('open', 'closed')),
  outcome text check (outcome in ('improved', 'referred', 'continuing')),
  close_note text,
  academic_year text, term int,
  opened_by uuid default auth.uid(), opened_by_name text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists guidance_cases_student_idx on public.guidance_cases (student_id);

create table if not exists public.guidance_sessions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.guidance_cases(id) on delete cascade,
  session_date date not null default current_date,
  kind text not null default 'individual' check (kind in ('individual', 'group', 'guardian', 'teacher')),
  summary text not null check (length(trim(summary)) > 0),  -- ما تم في الجلسة
  recommendation text,
  created_by uuid default auth.uid(), created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists guidance_sessions_case_idx on public.guidance_sessions (case_id);

alter table public.guidance_cases enable row level security;
alter table public.guidance_sessions enable row level security;

drop policy if exists "guidance cases access" on public.guidance_cases;
create policy "guidance cases access" on public.guidance_cases for all to authenticated
  using (public.guidance_can(grade)) with check (public.guidance_can(grade));

drop policy if exists "guidance sessions access" on public.guidance_sessions;
create policy "guidance sessions access" on public.guidance_sessions for all to authenticated
  using (exists (select 1 from public.guidance_cases c where c.id = case_id and public.guidance_can(c.grade)))
  with check (exists (select 1 from public.guidance_cases c where c.id = case_id and public.guidance_can(c.grade)));
-- نهاية الجزء 1
