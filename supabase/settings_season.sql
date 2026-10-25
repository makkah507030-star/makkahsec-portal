-- =====================================================================
-- صفحة «التوقيت الزمني»: حفظ التوقيت الفعّال (صيفي/شتوي) ومهلة السماح للتأخر.
-- كان جدول settings يُكتب للمدير وحده، فيرفض الحفظ للدعم الفني ولمن يملك
-- صلاحية «الاستيراد» التي تفتح الصفحة (new row violates row-level security).
-- السياسة تخص المفتاحين وحدهما، وبقية الإعدادات على حالها. تكرار التنفيذ آمن.
-- =====================================================================

drop policy if exists settings_season_write on public.settings;
create policy settings_season_write on public.settings as permissive for all to authenticated
  using (key in ('active_season', 'late_grace_minutes') and public.has_permission('import'))
  with check (key in ('active_season', 'late_grace_minutes') and public.has_permission('import'));

-- نهاية الجزء 1
