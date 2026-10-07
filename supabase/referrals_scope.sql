-- =====================================================================
-- الإحالات للمعنيين بها فقط
--
-- كان الموجهون الثلاثة (counselor_1/2/3) يقرؤون كل الإحالات ويعدّلونها.
-- بعد هذا الملف:
--   • الموجه يرى ويعالج الإحالات المحالة إليه هو فقط (counselor_id).
--   • وكيل شؤون الطلاب ومدير المدرسة والدعم الفني: كل الإحالات (لتوجيهها ومتابعتها).
--   • المعلم إحالاته، والوكيل الذي عالج الإحالة، والطالب وولي أمره: كما كان.
-- الدالة referral-assets (روابط التواقيع) تطبّق القاعدة نفسها.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

drop policy if exists "read referrals" on public.student_referrals;
create policy "read referrals" on public.student_referrals
  for select to authenticated
  using (
    teacher_id = (select auth.uid())
    or counselor_id = (select auth.uid())
    or deputy_id = (select auth.uid())
    or (select public.has_admin_role(array['principal', 'tech_support', 'deputy_students']))
    or exists (select 1 from public.students s
               where s.id = student_referrals.student_id and s.user_id = (select auth.uid()))
    or exists (select 1 from public.guardian_student gs
               join public.guardians g on g.id = gs.guardian_id
               where gs.student_id = student_referrals.student_id and g.user_id = (select auth.uid()))
  );

drop policy if exists "staff updates referral" on public.student_referrals;
create policy "staff updates referral" on public.student_referrals
  for update to authenticated
  using (
    (select public.has_admin_role(array['principal', 'tech_support', 'deputy_students']))
    or (counselor_id = (select auth.uid())
        and (select public.has_admin_role(array['counselor_1', 'counselor_2', 'counselor_3'])))
  );

-- للتحقق: القاعدتان بعد التعديل
select policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'student_referrals'
  and policyname in ('read referrals', 'staff updates referral');
