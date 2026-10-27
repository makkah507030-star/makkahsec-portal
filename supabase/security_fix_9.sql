-- =====================================================================
-- الاختبارات: التعديل والحذف لصاحب الاختبار وحده — الجزء 1 من 1.
-- كانت سياسات «own quizzes» و«own questions» و«own quiz classes» (لكل العمليات) تسمح
-- للمدير والدعم الفني ووكيل الشؤون التعليمية بحذف اختبار أي معلم وأسئلته وفصوله
-- (الحذف يكفيه شرط القراءة). صار لهم الاطلاع وحده، والكتابة والحذف للمعلم صاحب الاختبار.
-- لا يتغير شيء في الواجهة. يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

-- الاختبار
drop policy if exists "own quizzes" on public.quizzes;
drop policy if exists quizzes_staff_read on public.quizzes;
create policy quizzes_staff_read on public.quizzes for select to authenticated
  using (teacher_id = auth.uid() or public.has_admin_role(array['principal', 'tech_support', 'deputy_academic']));
drop policy if exists quizzes_owner_write on public.quizzes;
create policy quizzes_owner_write on public.quizzes for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- الأسئلة
drop policy if exists "own questions" on public.quiz_questions;
drop policy if exists quiz_questions_staff_read on public.quiz_questions;
create policy quiz_questions_staff_read on public.quiz_questions for select to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_questions.quiz_id
                 and (q.teacher_id = auth.uid() or public.has_admin_role(array['principal', 'tech_support', 'deputy_academic']))));
drop policy if exists quiz_questions_owner_write on public.quiz_questions;
create policy quiz_questions_owner_write on public.quiz_questions for all to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_questions.quiz_id and q.teacher_id = auth.uid()))
  with check (exists (select 1 from public.quizzes q where q.id = quiz_questions.quiz_id and q.teacher_id = auth.uid()));

-- فصول الاختبار
drop policy if exists "own quiz classes" on public.quiz_classes;
drop policy if exists quiz_classes_staff_read on public.quiz_classes;
create policy quiz_classes_staff_read on public.quiz_classes for select to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_classes.quiz_id
                 and (q.teacher_id = auth.uid() or public.has_admin_role(array['principal', 'tech_support', 'deputy_academic']))));
drop policy if exists quiz_classes_owner_write on public.quiz_classes;
create policy quiz_classes_owner_write on public.quiz_classes for all to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_classes.quiz_id and q.teacher_id = auth.uid()))
  with check (exists (select 1 from public.quizzes q where q.id = quiz_classes.quiz_id and q.teacher_id = auth.uid()));

-- التحقق: سياسات الكتابة في الجداول الثلاثة (يُفترض أن تشترط صاحب الاختبار وحده)
select tablename as "الجدول", policyname as "السياسة", cmd as "العملية",
       case when coalesce(qual, '') || coalesce(with_check, '') ~ 'principal|tech_support|deputy_academic|is_admin'
            then 'تحقق: تسمح لأدوار إدارية' else 'صاحب الاختبار' end as "الشرط"
  from pg_policies
 where schemaname = 'public' and cmd <> 'SELECT'
   and tablename in ('quizzes', 'quiz_questions', 'quiz_classes')
 order by 1, 2;
-- نهاية الجزء 1
