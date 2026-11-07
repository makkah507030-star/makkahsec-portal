-- =====================================================================
-- مختبرات العلوم: كشف العهدة للمحضر ومتابعيه وحدهم (مدير المدرسة، ووكيل الشؤون المدرسية،
-- والدعم الفني)، ولا يقرؤه معلمو المختبر. تكرار التنفيذ آمن.
-- =====================================================================
drop policy if exists sci_inv_r on public.sci_inventory;
create policy sci_inv_r on public.sci_inventory for select to authenticated using (public.sci_manager(lab));

-- نهاية الجزء 1
