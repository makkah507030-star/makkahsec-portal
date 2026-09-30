-- مرفقات الإفادة: يرفق المستفيد (المعلم أو الموظف) مع إفادته على نموذج — مثل
-- مساءلة الغياب — تقريرًا طبيًّا أو مستند عذر، PDF أو صورة.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.

-- 1) مخزن خاص: بلا روابط عامة، 5 م.ب للملف، PDF والصور فقط
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reply-files', 'reply-files', false, 5242880,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- المسار: <معرّف المستند>/<اسم الملف>

-- 2) القراءة: صاحب المستند، ومُصدِره، وإدارة النماذج (المدير والدعم الفني)
drop policy if exists "reply files read" on storage.objects;
create policy "reply files read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'reply-files'
    and exists (
      select 1 from public.form_documents d
      where d.id::text = (storage.foldername(name))[1]
        and (d.recipient_user_id = auth.uid()
             or d.created_by = auth.uid()
             or public.is_form_manager())
    )
  );

-- 3) الرفع والحذف: صاحب المستند وحده، وما دام المستند بانتظار إفادته
drop policy if exists "reply files write" on storage.objects;
create policy "reply files write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'reply-files'
    and exists (
      select 1 from public.form_documents d
      where d.id::text = (storage.foldername(name))[1]
        and d.recipient_user_id = auth.uid()
        and d.status = 'awaiting_reply'
    )
  );

drop policy if exists "reply files delete" on storage.objects;
create policy "reply files delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'reply-files'
    and exists (
      select 1 from public.form_documents d
      where d.id::text = (storage.foldername(name))[1]
        and d.recipient_user_id = auth.uid()
        and d.status = 'awaiting_reply'
    )
  );
