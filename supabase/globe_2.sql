-- =====================================================================
-- برنامج جلوب (الجزء 2 من 2): خطة البرنامج وخطة الرصد — بعد الجزء 1.
-- • globe_programs: برامج الخطة السنوية بموعدها، وتوثيق تنفيذها بالمستفيدين والأثر والصور.
-- • ميادين البحث الخمسة: الجو والمناخ (atmo)، والماء (hydro)، والتربة (pedo)،
--   وسطح الأرض والأحياء (bio)، والفينولوجيا (pheno).
-- • globe_observations: جلسات الرصد البيئي بالبروتوكول والموعد والمكان والطلاب المكلّفين،
--   وتوثيقها بالقراءات ورفعها إلى منصة GLOBE والصور.
-- • مخزن globe-files للصور: <programs|observations>/<المعرّف>/…
-- الكتابة لمن يملك صلاحية «برنامج جلوب»، والقراءة له ولمنسوبي الإدارة.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.globe_programs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  kind text not null default 'awareness' check (kind in ('awareness', 'training', 'field', 'research')),
  sphere text not null default 'all' check (sphere in ('all', 'atmo', 'hydro', 'pedo', 'bio', 'pheno')),
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

create table if not exists public.globe_observations (
  id uuid primary key default gen_random_uuid(),
  sphere text not null check (sphere in ('atmo', 'hydro', 'pedo', 'bio', 'pheno')),
  protocol text not null check (length(trim(protocol)) > 0),
  obs_date date not null,
  obs_time text,
  place text,
  student_ids uuid[] not null default '{}',
  status text not null default 'planned' check (status in ('planned', 'done', 'cancelled')),
  readings text,                                  -- ما رُصد من قراءات وملاحظات
  uploaded boolean not null default false,        -- رُفعت البيانات إلى منصة GLOBE
  photos text[] not null default '{}',
  academic_year text, term int,
  created_by uuid default auth.uid(), created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists globe_observations_date_idx on public.globe_observations (obs_date);

alter table public.globe_programs enable row level security;
alter table public.globe_observations enable row level security;

drop policy if exists globe_programs_read on public.globe_programs;
create policy globe_programs_read on public.globe_programs for select to authenticated
  using (public.has_permission('globe') or public.is_admin());
drop policy if exists globe_programs_write on public.globe_programs;
create policy globe_programs_write on public.globe_programs for all to authenticated
  using (public.has_permission('globe')) with check (public.has_permission('globe'));

drop policy if exists globe_obs_read on public.globe_observations;
create policy globe_obs_read on public.globe_observations for select to authenticated
  using (public.has_permission('globe') or public.is_admin());
drop policy if exists globe_obs_write on public.globe_observations;
create policy globe_obs_write on public.globe_observations for all to authenticated
  using (public.has_permission('globe')) with check (public.has_permission('globe'));

-- مخزن الصور (خاص)
insert into storage.buckets (id, name, public) values ('globe-files', 'globe-files', false)
on conflict (id) do nothing;
drop policy if exists "globe files read" on storage.objects;
create policy "globe files read" on storage.objects for select to authenticated
  using (bucket_id = 'globe-files' and (public.has_permission('globe') or public.is_admin()));
drop policy if exists "globe files write" on storage.objects;
create policy "globe files write" on storage.objects for all to authenticated
  using (bucket_id = 'globe-files' and public.has_permission('globe'))
  with check (bucket_id = 'globe-files' and public.has_permission('globe'));

-- للتحقق
select (select count(*) from public.globe_programs) as "برامج الخطة",
       (select count(*) from public.globe_observations) as "جلسات الرصد",
       exists (select 1 from storage.buckets where id = 'globe-files') as "مخزن الصور";
-- نهاية الجزء 2
