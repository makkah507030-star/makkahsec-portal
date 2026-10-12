-- =====================================================================
-- سؤال الاستماع في الاختبار الإلكتروني للغة الإنجليزية (الجزء 1 من 2)
--   • quizzes.listening_audio: مسار الملف الصوتي في مخزن quiz-audio.
--   • quiz_questions.listening: الفقرة من أسئلة الاستماع (اختيار متعدد أو صح وخطأ)،
--     وتُصحَّح آليًا كغيرها فلا تغيير في grade_submission.
--   • مخزن quiz-audio خاص: يرفعه معلم الاختبار ويحذفه، ويسمعه الطالب المُسنَد إليه
--     أثناء محاولته فقط (بدأ ولم يسلّم).
-- يُنفَّذ في Supabase ← SQL Editor، ثم الجزء 2. تكرار التنفيذ آمن.
-- =====================================================================

alter table public.quizzes        add column if not exists listening_audio text;
alter table public.quiz_questions add column if not exists listening boolean not null default false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quiz-audio', 'quiz-audio', false, 20971520, array['audio/*'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

-- معلم الاختبار
create or replace function public.quiz_audio_owner(p_folder text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from quizzes q where q.id::text = p_folder and q.teacher_id = auth.uid());
$$;

-- الطالب أثناء محاولته الجارية
create or replace function public.quiz_audio_listener(p_folder text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from quiz_assignments a join students s on s.id = a.student_id
     where a.quiz_id::text = p_folder and s.user_id = auth.uid()
       and a.started_at is not null and a.submitted_at is null);
$$;

drop policy if exists "quiz audio read" on storage.objects;
create policy "quiz audio read" on storage.objects for select to authenticated
  using (bucket_id = 'quiz-audio' and (public.quiz_audio_owner((storage.foldername(name))[1])
                                       or public.quiz_audio_listener((storage.foldername(name))[1])));

drop policy if exists "quiz audio write" on storage.objects;
create policy "quiz audio write" on storage.objects for insert to authenticated
  with check (bucket_id = 'quiz-audio' and public.quiz_audio_owner((storage.foldername(name))[1]));

drop policy if exists "quiz audio delete" on storage.objects;
create policy "quiz audio delete" on storage.objects for delete to authenticated
  using (bucket_id = 'quiz-audio' and public.quiz_audio_owner((storage.foldername(name))[1]));

-- نهاية الجزء 1
