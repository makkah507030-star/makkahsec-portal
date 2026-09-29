-- =====================================================================
-- حصص الانتظار: السماح للمعلم بإلغاء حجزه إذا فشل حفظ التحضير.
--
-- المشكلة: الحفظ يمرّ بخطوتين (حجز الحصة ثم حفظ التحضير). إن فشلت الثانية
-- بقي الحجز بلا تحضير، فتظهر عند إعادة المحاولة رسالة:
--   duplicate key value violates unique constraint
--   "substitute_periods_schedule_id_attend_date_key"
-- الواجهة تتراجع الآن عن الحجز عند الفشل، وهذا يحتاج صلاحية الحذف.
--
-- • المعلم يحذف حجزه هو فقط، ولليوم نفسه فقط (بتوقيت الرياض).
-- • يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- =====================================================================

drop policy if exists "teachers delete own substitute record today" on public.substitute_periods;
create policy "teachers delete own substitute record today"
  on public.substitute_periods
  for delete
  to authenticated
  using (
    attend_date = (now() at time zone 'Asia/Riyadh')::date
    and exists (
      select 1 from public.teachers t
      where t.id = substitute_periods.cover_teacher_id
        and t.user_id = auth.uid()
    )
  );

-- تنظيف الحجوزات العالقة: حجوزات اليوم التي لم يُحفظ لها أي تحضير
delete from public.substitute_periods sp
where sp.attend_date = (now() at time zone 'Asia/Riyadh')::date
  and not exists (
    select 1 from public.class_attendance ca
    where ca.schedule_id = sp.schedule_id
      and ca.attend_date = sp.attend_date
  );
