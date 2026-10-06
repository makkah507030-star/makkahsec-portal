-- =====================================================================
-- سجل المتابعة الإلكتروني 2 — توزيع المعلم لدرجات «المهام الأدائية والمشاركة
-- والتفاعل» (40 درجة) على بنودها.
--
-- • التوزيع لكل معلم × مادة × عام × فصل دراسي، ويسري على كل فصوله في المادة
--   وعلى الفترتين. مثال: {"homework": 10, "participation": 15, "classwork": 15}
-- • الرصد نفسه في جدول teacher_follow_up القائم ببنود مستقلة (r2_*)، فلا يتأثر
--   سجل المتابعة الإلكتروني الأول: لكل درجة خانة، 1 = ✓ و0 = ✗.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.teacher_follow_up_weights (
  teacher_id    uuid not null references public.teachers(id) on delete cascade,
  subject       text not null,
  academic_year text not null,
  term          integer not null,
  weights       jsonb not null check (jsonb_typeof(weights) = 'object'),
  updated_at    timestamptz not null default now(),
  primary key (teacher_id, subject, academic_year, term)
);

alter table public.teacher_follow_up_weights enable row level security;

drop policy if exists "teacher manage own follow-up weights" on public.teacher_follow_up_weights;
create policy "teacher manage own follow-up weights" on public.teacher_follow_up_weights
  for all to authenticated
  using (teacher_id in (select t.id from public.teachers t where t.user_id = (select auth.uid())))
  with check (teacher_id in (select t.id from public.teachers t where t.user_id = (select auth.uid())));
