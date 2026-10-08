-- =====================================================================
-- إجراءات المعلم قبل الإحالة (الجزء 2 من 2): أعمدة الإحالة ومرفقاتها.
--
-- • ref_type: سلوكية (behavior) أو تأخر دراسي (academic) أو أعمال أدائية
--   (performance)، لإحالة المعلم فقط. docs: توثيق المعلم قبل الإحالة.
-- • urgent_reason: سبب الإحالة المباشرة في الحالة العاجلة.
-- • الحالة returned_to_teacher: أعادها الوكيل لاستكمال التوثيق، ويعيد المعلم رفعها.
-- • مخزن referral-files: مرفقات الإحالة (PDF والصور، 5 م.ب للملف).
-- يُنفَّذ بعد الجزء 1. تكرار التنفيذ آمن.
-- =====================================================================

alter table public.student_referrals
  add column if not exists ref_type text,
  add column if not exists docs jsonb,
  add column if not exists urgent_reason text,
  add column if not exists teacher_return_note text;

alter table public.student_referrals drop constraint if exists student_referrals_ref_type_check;
alter table public.student_referrals add constraint student_referrals_ref_type_check
  check (ref_type is null or ref_type in ('behavior', 'academic', 'performance'));

alter table public.student_referrals drop constraint if exists student_referrals_status_check;
alter table public.student_referrals add constraint student_referrals_status_check
  check (status in ('with_deputy', 'with_counselor', 'returned_to_counselor', 'returned_to_teacher',
                    'closed', 'with_guardian', 'guardian_replied', 'archived'));

-- المعلم يستكمل الإحالة المعادة إليه ويعيد رفعها للوكيل
drop policy if exists "teacher resubmits referral" on public.student_referrals;
create policy "teacher resubmits referral" on public.student_referrals
  for update to authenticated
  using (teacher_id = (select auth.uid()) and status = 'returned_to_teacher')
  with check (teacher_id = (select auth.uid()) and status in ('returned_to_teacher', 'with_deputy'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('referral-files', 'referral-files', false, 5242880,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "referral files read" on storage.objects;
create policy "referral files read" on storage.objects for select to authenticated
  using (bucket_id = 'referral-files'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or public.has_admin_role(array['principal', 'tech_support', 'deputy_students',
                                             'counselor_1', 'counselor_2', 'counselor_3'])));

drop policy if exists "referral files write" on storage.objects;
create policy "referral files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'referral-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "referral files delete" on storage.objects;
create policy "referral files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'referral-files' and (storage.foldername(name))[1] = auth.uid()::text);
-- نهاية الجزء 2
