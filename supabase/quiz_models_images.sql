-- =====================================================================
-- الاختبار الورقي: صور داخل الأسئلة (ونموذجا أ/ب لا يحتاجان تغييرًا هنا).
--
--   • quiz_questions.image_path / image_width: صورة السؤال وعرضها في الورقة (٪).
--   • مخزن quiz-images خاص (لا روابط عامة): محتوى الاختبار لا يتسرّب قبل موعده.
--     المسار <معرّف الاختبار>/<اسم الملف>، والقراءة والرفع والحذف لمعلم الاختبار وحده.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- =====================================================================

alter table public.quiz_questions add column if not exists image_path  text;
alter table public.quiz_questions add column if not exists image_width int not null default 60;

insert into storage.buckets (id, name, public)
values ('quiz-images', 'quiz-images', false)
on conflict (id) do nothing;

drop policy if exists "quiz images read" on storage.objects;
create policy "quiz images read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'quiz-images'
    and exists (
      select 1 from public.quizzes q
      where q.id::text = (storage.foldername(name))[1] and q.teacher_id = auth.uid()
    )
  );

drop policy if exists "quiz images write" on storage.objects;
create policy "quiz images write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'quiz-images'
    and exists (
      select 1 from public.quizzes q
      where q.id::text = (storage.foldername(name))[1] and q.teacher_id = auth.uid()
    )
  );

drop policy if exists "quiz images delete" on storage.objects;
create policy "quiz images delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'quiz-images'
    and exists (
      select 1 from public.quizzes q
      where q.id::text = (storage.foldername(name))[1] and q.teacher_id = auth.uid()
    )
  );
