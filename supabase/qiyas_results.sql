-- =====================================================================
-- مركز التحصيل: نتائج اختبارات هيئة تقويم التعليم (القدرات والتحصيلي وSTEP).
-- تُرفع بملف Excel (من قياس أو كشف المدرسة) فيطابَق كل طالب برقم هويته، أو تُدخل لطالب
-- واحد. يرفعها الوكيل والمدير والدعم الفني وأعضاء لجنة التحصيل، ويراها معهم الموجه لصفه
-- والطالب وولي أمره. يُنفَّذ بعد ach_committee.sql. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.qiyas_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  test text not null check (test in ('qudrat', 'tahsili', 'step')),
  attempt text not null default 'الأولى',      -- المحاولة أو الفترة كما في الملف
  score numeric not null check (score >= 0 and score <= 100),
  taken_on date,
  academic_year text not null,
  uploaded_by uuid default auth.uid(), uploader_name text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (student_id, test, attempt)
);
create index if not exists qiyas_results_test on public.qiyas_results (test, academic_year);

create or replace function public.qiyas_can_write() returns boolean language sql stable security definer set search_path = public as $$
  select public.ach_can_decide() or public.ach_is_member();
$$;

alter table public.qiyas_results enable row level security;
drop policy if exists qiyas_staff on public.qiyas_results;
create policy qiyas_staff on public.qiyas_results for select to authenticated
  using (public.ach_all() or public.ach_is_member() or public.sf_can(student_id));
drop policy if exists qiyas_own on public.qiyas_results;
create policy qiyas_own on public.qiyas_results for select to authenticated
  using (exists (select 1 from students s where s.id = student_id and s.user_id = auth.uid())
      or exists (select 1 from guardian_student gs join guardians g on g.id = gs.guardian_id
                 where gs.student_id = qiyas_results.student_id and g.user_id = auth.uid()));
drop policy if exists qiyas_write on public.qiyas_results;
create policy qiyas_write on public.qiyas_results for all to authenticated
  using (public.qiyas_can_write()) with check (public.qiyas_can_write());
grant select, insert, update, delete on public.qiyas_results to authenticated;
revoke all on function public.qiyas_can_write() from public, anon;
grant execute on function public.qiyas_can_write() to authenticated;

-- نهاية الجزء 1
