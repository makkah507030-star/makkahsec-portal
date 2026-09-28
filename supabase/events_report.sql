-- تقرير الحدث واعتماده.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.

-- 1) أعمدة التقرير والاعتماد
alter table public.school_events add column if not exists report_summary         text;
alter table public.school_events add column if not exists report_outcomes        text;
alter table public.school_events add column if not exists report_recommendations text;
alter table public.school_events add column if not exists report_photos          text[] not null default '{}';
alter table public.school_events add column if not exists report_submitted_at    timestamptz;
alter table public.school_events add column if not exists approval_note          text;
alter table public.school_events add column if not exists approved_at            timestamptz;
alter table public.school_events add column if not exists approved_by_name       text;

-- 2) مخزن خاص لصور التنفيذ — صور طلاب، فلا تُتاح برابط عام
insert into storage.buckets (id, name, public)
values ('event-reports', 'event-reports', false)
on conflict (id) do nothing;

-- المسار: <معرّف الحدث>/<اسم الملف>. القراءة لمنظّم الحدث والإدارة المعنية،
-- والرفع والحذف لمنظّم الحدث والمدير والدعم الفني ووكيل شؤون الطلاب.
drop policy if exists "event reports read" on storage.objects;
create policy "event reports read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'event-reports'
    and exists (
      select 1 from public.school_events e
      where e.id::text = (storage.foldername(name))[1]
        and (e.organizer_id = auth.uid()
             or public.has_admin_role(array['principal', 'tech_support', 'deputy_students',
                                            'deputy_academic', 'activity_leader']))
    )
  );

drop policy if exists "event reports write" on storage.objects;
create policy "event reports write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-reports'
    and exists (
      select 1 from public.school_events e
      where e.id::text = (storage.foldername(name))[1]
        and (e.organizer_id = auth.uid()
             or public.has_admin_role(array['principal', 'tech_support', 'deputy_students']))
    )
  );

drop policy if exists "event reports delete" on storage.objects;
create policy "event reports delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-reports'
    and exists (
      select 1 from public.school_events e
      where e.id::text = (storage.foldername(name))[1]
        and (e.organizer_id = auth.uid()
             or public.has_admin_role(array['principal', 'tech_support', 'deputy_students']))
    )
  );
