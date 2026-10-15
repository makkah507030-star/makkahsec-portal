-- =====================================================================
-- صور الأسئلة والخيارات في الاختبار الإلكتروني والتصحيح الآلي (الجزء 1 من 2)
--   • quiz_questions.option_images: صور خيارات الاختيار من متعدد، مصفوفة
--     بترتيب الخيارات (null للخيار بلا صورة). صورة السؤال في image_path كما في الورقي.
--   • مخزن quiz-images: يراه الطالب المُسنَد إليه أثناء محاولته الجارية فقط
--     (بدأ ولم يسلّم)، كالملف الصوتي في سؤال الاستماع. ويبقى المعلم وحده يرفع ويحذف.
-- يُنفَّذ بعد supabase/quiz_models_images.sql، ثم الجزء 2. تكرار التنفيذ آمن.
-- =====================================================================

alter table public.quiz_questions add column if not exists option_images jsonb;

-- الطالب أثناء محاولته الجارية في الاختبار (المجلد = معرّف الاختبار)
create or replace function public.quiz_image_viewer(p_folder text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from quiz_assignments a join students s on s.id = a.student_id
     where a.quiz_id::text = p_folder and s.user_id = auth.uid()
       and a.started_at is not null and a.submitted_at is null);
$$;

drop policy if exists "quiz images student read" on storage.objects;
create policy "quiz images student read" on storage.objects for select to authenticated
  using (bucket_id = 'quiz-images' and public.quiz_image_viewer((storage.foldername(name))[1]));

-- نهاية الجزء 1
