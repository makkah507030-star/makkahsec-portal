-- =====================================================================
-- صفحة «التوقيت الزمني»: تفعيل التوقيت (الصيفي أو الشتوي أو رمضان)، ومهلة السماح
-- للتأخر، وتعديل جدول أوقات الحصص لكل توقيت.
-- كان جدول settings يُكتب للمدير وحده، فيرفض الحفظ للدعم الفني ولمن يملك
-- صلاحية «الاستيراد» التي تفتح الصفحة (new row violates row-level security).
-- السياسة تخص المفتاحين وحدهما، وبقية الإعدادات على حالها. وجدول الأوقات كان للمدير
-- والدعم الفني وحدهما، فيُفتح لمن يملك الصلاحية نفسها كي لا يتكرر الخطأ. تكرار التنفيذ آمن.
-- =====================================================================

drop policy if exists settings_season_write on public.settings;
create policy settings_season_write on public.settings as permissive for all to authenticated
  using (key in ('active_season', 'late_grace_minutes') and public.has_permission('import'))
  with check (key in ('active_season', 'late_grace_minutes') and public.has_permission('import'));

-- أوقات الحصص للتوقيتات الثلاثة (الصيفي والشتوي ورمضان)
drop policy if exists period_times_write on public.period_times;
create policy period_times_write on public.period_times as permissive for all to authenticated
  using (public.has_permission('import'))
  with check (public.has_permission('import'));

-- نهاية الجزء 1
