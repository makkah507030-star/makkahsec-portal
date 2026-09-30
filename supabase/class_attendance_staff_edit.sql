-- تعديل حضور الحصص من الإدارة (شؤون الطلاب ← ملف الطالب ← تعديل حضور الحصص):
-- إلغاء غياب حصة أو تغيير نوعه بعد انتهاء وقتها، ومنها حصص الانتظار.
-- التعديل للمدير والدعم الفني ووكيل شؤون الطلاب، وللتعديل (UPDATE) وحده — لا
-- إضافة سجلات ولا حذفها. (catt_admin_write القديمة تشمل principal وdeputy وclerk.)
-- التعديل إلى «حاضر» أو «متأخر» أو «مستأذن» لا يُرسل أي إشعار لولي الأمر.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.

drop policy if exists catt_staff_edit on public.class_attendance;
create policy catt_staff_edit on public.class_attendance
  for update to authenticated
  using (has_any_admin_role(array['principal', 'tech_support', 'deputy_students']::admin_role_type[]))
  with check (has_any_admin_role(array['principal', 'tech_support', 'deputy_students']::admin_role_type[]));
