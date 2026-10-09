-- =====================================================================
-- التطوير المهني (الجزء 3 من 4): تقارير جلسات مجتمع التعلم المهني.
--
-- • plc_sessions: يصدرها رئيس القسم بمراحل: مسودة ← توقيع الحاضرين ←
--   بانتظار الاعتماد ← معتمدة (أو مُعادة بملاحظة وكيل الشؤون التعليمية).
--   attendees: [{ teacher_id, user_id, name }] من معلمي قسمه.
-- • plc_signatures: توقيع كل حاضر بنفسه.
-- • المدير ووكيل الشؤون التعليمية والدعم الفني يطّلعون على الجلسات كلها.
-- • مخزن plc-photos: ثلاث صور شواهد لكل جلسة.
-- يُنفَّذ بعد الجزأين 1 و2. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.plc_sessions (
  id uuid primary key default gen_random_uuid(),
  serial text,
  department_id uuid not null references public.departments(id),
  head_user_id uuid not null default auth.uid(),
  head_name text,
  academic_year text,
  data jsonb not null default '{}'::jsonb,       -- البيانات والمحتوى
  attendees jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,     -- [{ path, name }]
  status text not null default 'draft'
    check (status in ('draft', 'signing', 'pending', 'approved', 'returned')),
  sent_at timestamptz,
  submitted_at timestamptz,
  decided_by uuid, decided_name text, decided_at timestamptz, decision_note text,
  principal_note text, principal_name text, principal_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plc_sessions_dept_idx on public.plc_sessions (department_id, created_at desc);

create table if not exists public.plc_signatures (
  session_id uuid not null references public.plc_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  name text,
  signed_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

alter table public.plc_sessions enable row level security;
alter table public.plc_signatures enable row level security;

-- هل المستخدم رئيس هذا القسم
create or replace function public.is_dept_head(p_dept uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from department_members m join teachers t on t.id = m.teacher_id
                  where m.department_id = p_dept and m.is_head and t.user_id = auth.uid());
$$;
grant execute on function public.is_dept_head(uuid) to authenticated;

drop policy if exists plc_read on public.plc_sessions;
create policy plc_read on public.plc_sessions for select to authenticated
  using (head_user_id = auth.uid()
         or attendees @> jsonb_build_array(jsonb_build_object('user_id', auth.uid()))
         or public.has_admin_role(array['principal', 'deputy_academic', 'tech_support']));

drop policy if exists plc_insert on public.plc_sessions;
create policy plc_insert on public.plc_sessions for insert to authenticated
  with check (head_user_id = auth.uid() and public.is_dept_head(department_id) and status = 'draft');

-- رئيس القسم يعدّل قبل الرفع للاعتماد، والدعم الفني لمعالجة الأخطاء
drop policy if exists plc_update on public.plc_sessions;
create policy plc_update on public.plc_sessions for update to authenticated
  using ((head_user_id = auth.uid() and status in ('draft', 'signing', 'returned'))
         or public.has_admin_role(array['tech_support']))
  with check ((head_user_id = auth.uid() and status in ('draft', 'signing', 'returned'))
              or public.has_admin_role(array['tech_support']));

drop policy if exists plc_delete on public.plc_sessions;
create policy plc_delete on public.plc_sessions for delete to authenticated
  using ((head_user_id = auth.uid() and status = 'draft') or public.has_admin_role(array['tech_support']));

drop policy if exists plc_sig_read on public.plc_signatures;
create policy plc_sig_read on public.plc_signatures for select to authenticated
  using (exists (select 1 from public.plc_sessions s where s.id = session_id));   -- يتبع قراءة الجلسة

drop policy if exists plc_sig_insert on public.plc_signatures;
create policy plc_sig_insert on public.plc_signatures for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.plc_sessions s where s.id = session_id and s.status = 'signing'
       and s.attendees @> jsonb_build_array(jsonb_build_object('user_id', auth.uid()))));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plc-photos', 'plc-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "plc photos read" on storage.objects;
create policy "plc photos read" on storage.objects for select to authenticated using (bucket_id = 'plc-photos');
drop policy if exists "plc photos write" on storage.objects;
create policy "plc photos write" on storage.objects for insert to authenticated
  with check (bucket_id = 'plc-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "plc photos delete" on storage.objects;
create policy "plc photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'plc-photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- نهاية الجزء 3
