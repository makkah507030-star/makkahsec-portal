-- =====================================================================
-- نشر نتائج الاختبارات القصيرة والتغذية الراجعة — الجزء 1 من 2.
-- • results_published: يقرّر المعلم متى تظهر الدرجة للطالب وولي أمره.
-- • feedback_enabled: يتيح للطالب إحصائيات اختباره (الجزء 2).
-- الاختبارات المرصودة قبل هذا التحديث تبقى ظاهرة كما كانت.
-- my_quiz_results: صار لا يقرؤه إلا الطالب نفسه أو ولي أمره أو منسوبو المدرسة.
-- تكرار التنفيذ آمن.
-- =====================================================================

alter table public.quizzes add column if not exists results_published boolean;
alter table public.quizzes add column if not exists feedback_enabled boolean not null default false;
alter table public.quizzes add column if not exists results_published_at timestamptz;

-- أول تشغيل فقط: ما كان ظاهرًا يبقى ظاهرًا، ثم يصير الافتراضي «غير منشور»
update public.quizzes
   set results_published = status in ('marking', 'closed'),
       results_published_at = case when status in ('marking', 'closed') then now() end
 where results_published is null;
alter table public.quizzes alter column results_published set default false;
alter table public.quizzes alter column results_published set not null;

-- يقرأ الطالب سجله، وولي الأمر أبناءه، ومنسوبو المدرسة الجميع
create or replace function public.can_read_student(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from students s where s.id = p_student and s.user_id = auth.uid())
      or exists (select 1 from guardian_student gs join guardians g on g.id = gs.guardian_id
                  where gs.student_id = p_student and g.user_id = auth.uid())
      or public.sa_is_staff();
$$;

drop function if exists public.my_quiz_results(uuid);
create function public.my_quiz_results(p_student uuid)
returns table (quiz_id uuid, title text, subject_name text, period text, exam_date date,
               score numeric, total numeric, absent boolean, feedback boolean)
language sql stable security definer set search_path = public as $$
  select q.id, q.title, q.subject_name, q.period, q.exam_date,
         sub.score, q.total_marks, sub.absent, q.feedback_enabled
    from quiz_submissions sub
    join quizzes q on q.id = sub.quiz_id
   where sub.student_id = p_student
     and public.can_read_student(p_student)
     and q.status in ('marking', 'closed')
     -- المنشور، أو الإلكتروني الذي اختار معلمه إظهار النتيجة فور التسليم
     and (q.results_published
          or exists (select 1 from quiz_online o where o.quiz_id = q.id and o.show_result))
   order by q.exam_date desc nulls last, q.created_at desc;
$$;

revoke execute on function public.can_read_student(uuid) from public, anon;
grant  execute on function public.can_read_student(uuid) to authenticated;
revoke execute on function public.my_quiz_results(uuid) from public, anon;
grant  execute on function public.my_quiz_results(uuid) to authenticated;
-- نهاية الجزء 1
