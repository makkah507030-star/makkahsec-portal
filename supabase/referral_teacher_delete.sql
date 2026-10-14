-- =====================================================================
-- المعلم يحذف إحالته ما لم يُتخذ فيها إجراء:
-- لدى الوكيل ولم يحوّلها بعد، أو أعادها له الوكيل لاستكمال التوثيق،
-- ولم يصلها الموجه ولا ولي الأمر. يبقى حذف أي إحالة للمدير والدعم الفني.
-- تكرار التنفيذ آمن.
-- =====================================================================

drop policy if exists "teacher deletes own pending referral" on public.student_referrals;
create policy "teacher deletes own pending referral" on public.student_referrals
  for delete to authenticated
  using (teacher_id = (select auth.uid())
         and status in ('with_deputy', 'returned_to_teacher')
         and deputy_at is null and counselor_id is null
         and counselor_at is null and closed_at is null);
-- نهاية الجزء 1
