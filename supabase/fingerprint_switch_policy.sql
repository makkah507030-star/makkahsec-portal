-- =====================================================================
-- زر «البصمة مقفلة / مفعّلة» في شؤون الطلاب: تتيحه الصفحة للمدير والدعم الفني
-- ووكيل شؤون الطلاب، لكن الكتابة في الإعدادات كانت للمدير وحده، فيُرفض الحفظ
-- لغيره بخطأ «new row violates row-level security policy for table settings».
-- هذه السياسة تسمح للثلاثة بمفتاحي البصمة وحدهما، وتبقى بقية الإعدادات للمدير.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

drop policy if exists settings_fingerprint_write on public.settings;
create policy settings_fingerprint_write on public.settings as PERMISSIVE for ALL to authenticated
  using (key in ('fingerprint_enabled', 'fingerprint_enabled_since')
         and public.has_admin_role(array['principal', 'tech_support', 'deputy_students']))
  with check (key in ('fingerprint_enabled', 'fingerprint_enabled_since')
              and public.has_admin_role(array['principal', 'tech_support', 'deputy_students']));

-- نهاية الملف
