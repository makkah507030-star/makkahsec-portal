-- =====================================================================
-- استوديو البوابة: صلاحيات القوالب — من يستخدم كل قالب.
-- تُحفظ في settings بالمفتاح studio_access، والكتابة في settings للمدير وحده،
-- فهذه السياسة تسمح للدعم الفني أيضًا بتعديل هذا المفتاح فقط.
-- قبل تشغيله: المدير يحفظ الصلاحيات عاديًا، والقوالب تعمل بالافتراضي.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

drop policy if exists settings_studio_access_write on public.settings;
create policy settings_studio_access_write on public.settings as PERMISSIVE for ALL to authenticated
  using (key = 'studio_access' and has_admin_role('tech_support'::admin_role_type))
  with check (key = 'studio_access' and has_admin_role('tech_support'::admin_role_type));
