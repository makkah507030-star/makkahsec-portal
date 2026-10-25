-- =====================================================================
-- مركز التحصيل: نتائج اختبارات هيئة تقويم التعليم (القدرات والتحصيلي وSTEP) — الجزء 1 من 2.
-- النتيجة خاصة بالطالب ولا تصل المدرسة من قياس، فيُدخلها الطالب من حسابه مع صورة إثباتها،
-- وتتحقق منها لجنة التحصيل أو الوكيل، ولا يدخل التحليل إلا ما تُحقّق منه. ويمكن للجنة إدخال
-- نتيجة يقدّمها الطالب بنفسه فتُعتمد مباشرة. يُنفَّذ بعد ach_committee.sql. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.qiyas_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  test text not null check (test in ('qudrat', 'tahsili', 'step')),
  attempt text not null default 'المحاولة الأولى',
  score numeric not null check (score >= 0 and score <= 100),
  taken_on date,
  academic_year text not null,
  source text not null default 'student' check (source in ('student', 'staff')),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  proof_path text,                              -- صورة الإثبات في مخزن qiyas-proofs
  reject_reason text, verified_by_name text, verified_at timestamptz,
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
-- إدخال اللجنة وحذفها مباشرة؛ أما الطالب فمن الدالة qiyas_submit (الجزء 2)
drop policy if exists qiyas_write on public.qiyas_results;
create policy qiyas_write on public.qiyas_results for all to authenticated
  using (public.qiyas_can_write()) with check (public.qiyas_can_write());
grant select, insert, update, delete on public.qiyas_results to authenticated;
revoke all on function public.qiyas_can_write() from public, anon;
grant execute on function public.qiyas_can_write() to authenticated;

-- نهاية الجزء 1
