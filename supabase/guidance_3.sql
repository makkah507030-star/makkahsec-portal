-- =====================================================================
-- التوجيه الطلابي — الجزء 3: الخطة الإرشادية والبرامج.
-- لكل صف خطته: برامج توعوية ووقائية ونمائية وعلاجية بموعدها، وتوثيق تنفيذها
-- بعدد المستفيدين وأثرها وحتى 3 صور (مخزن guidance-files: <الصف>/<البرنامج>/…).
-- الصلاحية: guidance_can (موجه الصف، والوكيل والمدير والدعم الفني).
-- يُنفَّذ بعد الجزء 1. تكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.guidance_programs (
  id uuid primary key default gen_random_uuid(),
  grade int not null check (grade between 1 and 3),
  title text not null check (length(trim(title)) > 0),
  kind text not null default 'awareness' check (kind in ('awareness', 'preventive', 'developmental', 'remedial')),
  target text,                                    -- الفئة المستهدفة
  planned_date date,
  status text not null default 'planned' check (status in ('planned', 'done')),
  done_date date,
  beneficiaries int,
  outcome text,                                   -- الأثر والملاحظات
  photos text[] not null default '{}',
  academic_year text, term int,
  created_by uuid default auth.uid(), created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists guidance_programs_grade_idx on public.guidance_programs (grade, planned_date);

alter table public.guidance_programs enable row level security;
drop policy if exists "guidance programs access" on public.guidance_programs;
create policy "guidance programs access" on public.guidance_programs for all to authenticated
  using (public.guidance_can(grade)) with check (public.guidance_can(grade));

insert into storage.buckets (id, name, public) values ('guidance-files', 'guidance-files', false)
on conflict (id) do nothing;

drop policy if exists "guidance files access" on storage.objects;
create policy "guidance files access" on storage.objects for all to authenticated
  using (bucket_id = 'guidance-files' and (storage.foldername(name))[1] in ('1', '2', '3')
         and public.guidance_can(((storage.foldername(name))[1])::int))
  with check (bucket_id = 'guidance-files' and (storage.foldername(name))[1] in ('1', '2', '3')
         and public.guidance_can(((storage.foldername(name))[1])::int));
-- نهاية الجزء 3
