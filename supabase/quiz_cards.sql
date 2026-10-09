-- =====================================================================
-- صورة بطاقة الإجابة بعد التصحيح بالكاميرا: تُحفظ البطاقة المعدولة بالرمادي
-- (نحو 50 ك.ب) لا صورة الجوال، في مخزن خاص quiz-cards بالمسار
-- <معرّف الاختبار>/<معرّف الطالب>-<وقت>.jpg، ومسارها في quiz_submissions.card_path.
-- يراها معلم الاختبار، والطالب وولي أمره إن أتاحها المعلم (quizzes.card_visible)
-- بعد نشر النتيجة. يُنفَّذ بعد quiz_publish_1.sql. تكرار التنفيذ آمن.
-- =====================================================================

alter table public.quiz_submissions add column if not exists card_path text;
alter table public.quizzes add column if not exists card_visible boolean not null default false;

insert into storage.buckets (id, name, public) values ('quiz-cards', 'quiz-cards', false)
on conflict (id) do nothing;

-- معلم الاختبار: يرفع ويقرأ ويحذف بطاقات اختباره
drop policy if exists "quiz cards teacher" on storage.objects;
create policy "quiz cards teacher" on storage.objects for all to authenticated
  using (bucket_id = 'quiz-cards' and exists (select 1 from public.quizzes q
           where q.id::text = (storage.foldername(name))[1] and q.teacher_id = auth.uid()))
  with check (bucket_id = 'quiz-cards' and exists (select 1 from public.quizzes q
           where q.id::text = (storage.foldername(name))[1] and q.teacher_id = auth.uid()));

-- الطالب وولي أمره: بطاقته هو فقط، حين ينشر المعلم النتيجة ويتيح البطاقة.
-- دالة بصلاحية المالك لأن الطالب لا يقرأ quiz_submissions مباشرة.
create or replace function public.quiz_card_readable(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from quiz_submissions s join quizzes q on q.id = s.quiz_id
                  where s.card_path = p_name and q.card_visible and q.results_published
                    and public.can_read_student(s.student_id));
$$;
revoke execute on function public.quiz_card_readable(text) from public, anon;
grant  execute on function public.quiz_card_readable(text) to authenticated;

drop policy if exists "quiz cards student" on storage.objects;
create policy "quiz cards student" on storage.objects for select to authenticated
  using (bucket_id = 'quiz-cards' and public.quiz_card_readable(name));

drop function if exists public.my_quiz_results(uuid);
create function public.my_quiz_results(p_student uuid)
returns table (quiz_id uuid, title text, subject_name text, period text, exam_date date,
               score numeric, total numeric, absent boolean, feedback boolean, card_path text)
language sql stable security definer set search_path = public as $$
  select q.id, q.title, q.subject_name, q.period, q.exam_date,
         sub.score, q.total_marks, sub.absent, q.feedback_enabled,
         case when q.card_visible and q.results_published then sub.card_path end
    from quiz_submissions sub
    join quizzes q on q.id = sub.quiz_id
   where sub.student_id = p_student
     and public.can_read_student(p_student)
     and q.status in ('marking', 'closed')
     and (q.results_published
          or exists (select 1 from quiz_online o where o.quiz_id = q.id and o.show_result))
   order by q.exam_date desc nulls last, q.created_at desc;
$$;
revoke execute on function public.my_quiz_results(uuid) from public, anon;
grant  execute on function public.my_quiz_results(uuid) to authenticated;
-- نهاية الملف
