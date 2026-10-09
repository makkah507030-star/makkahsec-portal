-- =====================================================================
-- التطوير المهني (الجزء 8 من 9): نماذج سجل التطوير المهني الخمسة الباقية.
--
-- pd_reports بنوعين من المسار:
-- • بحاضرين يوقّعون: training (تنفيذ برنامج تدريبي 2-1) و applied (درس
--   تطبيقي أو حلقة تنشيطية 2-7) — والحاضرون يُحتسب لهم 2-2.
-- • تقرير ذاتي بمرفقات: attend (حضور برنامج تدريبي 2-2) و conference
--   (حضور مؤتمر 2-5) و production (إنتاج معرفي أو تجربة أو وسيلة أو تطوع 2-8).
-- الاعتماد لوكيل الشؤون التعليمية، والاطلاع لرئيس القسم والمدير.
-- يُنفَّذ بعد الأجزاء 1–7. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.pd_reports (
  id uuid primary key default gen_random_uuid(),
  serial text,
  kind text not null check (kind in ('training', 'applied', 'attend', 'conference', 'production')),
  department_id uuid references public.departments(id),
  owner_user_id uuid not null default auth.uid(),
  owner_name text,
  academic_year text,
  data jsonb not null default '{}'::jsonb,
  attendees jsonb not null default '[]'::jsonb,     -- [{ teacher_id, user_id, name }]
  files jsonb not null default '[]'::jsonb,         -- [{ path, name, type }]
  status text not null default 'draft' check (status in ('draft', 'signing', 'pending', 'approved', 'returned')),
  sent_at timestamptz, submitted_at timestamptz,
  decided_by uuid, decided_name text, decided_at timestamptz, decision_note text,
  principal_note text, principal_name text, principal_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pd_reports_owner_idx on public.pd_reports (owner_user_id, created_at desc);

create table if not exists public.pd_signatures (
  report_id uuid not null references public.pd_reports(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  name text,
  signed_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

alter table public.pd_reports enable row level security;
alter table public.pd_signatures enable row level security;

drop policy if exists pd_read on public.pd_reports;
create policy pd_read on public.pd_reports for select to authenticated
  using (owner_user_id = auth.uid()
         or attendees @> jsonb_build_array(jsonb_build_object('user_id', auth.uid()))
         or (department_id is not null and public.is_dept_head(department_id))
         or public.has_admin_role(array['principal', 'deputy_academic', 'tech_support']));

drop policy if exists pd_insert on public.pd_reports;
create policy pd_insert on public.pd_reports for insert to authenticated
  with check (owner_user_id = auth.uid() and status = 'draft'
              and exists (select 1 from public.teachers t where t.user_id = auth.uid()));

drop policy if exists pd_update on public.pd_reports;
create policy pd_update on public.pd_reports for update to authenticated
  using ((owner_user_id = auth.uid() and status in ('draft', 'signing', 'returned')) or public.has_admin_role(array['tech_support']))
  with check ((owner_user_id = auth.uid() and status in ('draft', 'signing', 'returned')) or public.has_admin_role(array['tech_support']));

drop policy if exists pd_delete on public.pd_reports;
create policy pd_delete on public.pd_reports for delete to authenticated
  using ((owner_user_id = auth.uid() and status = 'draft') or public.has_admin_role(array['tech_support']));

drop policy if exists pd_sig_read on public.pd_signatures;
create policy pd_sig_read on public.pd_signatures for select to authenticated
  using (exists (select 1 from public.pd_reports r where r.id = report_id));
drop policy if exists pd_sig_insert on public.pd_signatures;
create policy pd_sig_insert on public.pd_signatures for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.pd_reports r where r.id = report_id and r.status = 'signing'
       and r.attendees @> jsonb_build_array(jsonb_build_object('user_id', auth.uid()))));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pd-files', 'pd-files', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "pd files read" on storage.objects;
create policy "pd files read" on storage.objects for select to authenticated using (bucket_id = 'pd-files');
drop policy if exists "pd files write" on storage.objects;
create policy "pd files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'pd-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "pd files delete" on storage.objects;
create policy "pd files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'pd-files' and (storage.foldername(name))[1] = auth.uid()::text);
-- نهاية الجزء 8
