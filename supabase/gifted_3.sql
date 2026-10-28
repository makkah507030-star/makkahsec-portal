-- =====================================================================
-- برنامج الموهوبين (الجزء 3): خطة البرنامج. يُنفَّذ بعد gifted_2.sql.
-- • gifted_programs: برامج العام بنوعها (إثرائي، تدريبي، مسابقة، زيارة) ومجالها وموعدها،
--   وتوثيق تنفيذها بالمستفيدين والأثر وحتى 3 صور.
-- • مخزن gifted-files الخاص للصور: programs/<المعرّف>/…
-- الكتابة لمن يملك صلاحية «برنامج الموهوبين»، والقراءة له ولمنسوبي الإدارة.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.gifted_programs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  kind text not null default 'enrichment' check (kind in ('enrichment', 'training', 'competition', 'visit')),
  domain text not null default 'all',
  target text,
  planned_date date,
  status text not null default 'planned' check (status in ('planned', 'done')),
  done_date date,
  beneficiaries int,
  outcome text,
  photos text[] not null default '{}',
  academic_year text, term int,
  created_by uuid default auth.uid(), created_by_name text,
  created_at timestamptz not null default now()
);
alter table public.gifted_programs enable row level security;
drop policy if exists gifted_programs_read on public.gifted_programs;
create policy gifted_programs_read on public.gifted_programs for select to authenticated
  using (public.has_permission('gifted') or public.is_admin());
drop policy if exists gifted_programs_write on public.gifted_programs;
create policy gifted_programs_write on public.gifted_programs for all to authenticated
  using (public.has_permission('gifted')) with check (public.has_permission('gifted'));

insert into storage.buckets (id, name, public) values ('gifted-files', 'gifted-files', false)
on conflict (id) do nothing;
drop policy if exists "gifted files read" on storage.objects;
create policy "gifted files read" on storage.objects for select to authenticated
  using (bucket_id = 'gifted-files' and (public.has_permission('gifted') or public.is_admin()));
drop policy if exists "gifted files write" on storage.objects;
create policy "gifted files write" on storage.objects for all to authenticated
  using (bucket_id = 'gifted-files' and public.has_permission('gifted'))
  with check (bucket_id = 'gifted-files' and public.has_permission('gifted'));

-- للتحقق
select (select count(*) from public.gifted_programs) as "برامج الخطة",
       exists (select 1 from storage.buckets where id = 'gifted-files') as "مخزن الصور";
-- نهاية الجزء 3
