-- =====================================================================
-- إغلاق الإحالة تلقائيًا بعد أسبوع عند ولي الأمر دون رد — الجزء 1 من 1.
-- • كانت تبقى «لدى ولي الأمر» حتى يغلقها الوكيل يدويًا، فتظهر في المتابعة والإجراءات.
-- • الدالة referrals_auto_close تُغلق (archived) كل إحالة مضى على إرسالها لولي الأمر
--   (closed_at) سبعة أيام ولم يؤكد استلامها، وتضيف للملاحظة سبب الإغلاق.
--   تستدعيها البوابة عند تحميلها وعند فتح صفحة الإحالات (src/lib/referrals.js).
-- • وفي آخر الملف تُغلق المتأخرة الآن مرة واحدة.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.referrals_auto_close()
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then return 0; end if;
  update student_referrals
     set status = 'archived',
         close_note = concat_ws(E'\n', nullif(close_note, ''), 'أُغلقت تلقائيًا بعد 7 أيام دون رد ولي الأمر.')
   where status = 'with_guardian'
     and guardian_ack_at is null
     and closed_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.referrals_auto_close() from public, anon;
grant execute on function public.referrals_auto_close() to authenticated;

-- إغلاق المتأخرة الآن (التنفيذ من SQL Editor بلا مستخدم، فيُكتب التحديث مباشرة)
update public.student_referrals
   set status = 'archived',
       close_note = concat_ws(E'\n', nullif(close_note, ''), 'أُغلقت تلقائيًا بعد 7 أيام دون رد ولي الأمر.')
 where status = 'with_guardian'
   and guardian_ack_at is null
   and closed_at < now() - interval '7 days';

-- نهاية الجزء 1
