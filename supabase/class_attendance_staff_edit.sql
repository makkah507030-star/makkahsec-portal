-- تعديل حضور الحصص من الإدارة (شؤون الطلاب ← ملف الطالب ← تعديل حضور الحصص):
-- إلغاء غياب حصة أو تغيير نوعه بعد انتهاء وقتها، ومنها حصص الانتظار.
-- السياسة القديمة catt_admin_write تشمل principal وdeputy وclerk فقط، فهذه تضيف
-- الأدوار الأحدث للتعديل (UPDATE) وحده — لا إضافة سجلات ولا حذفها.
-- التعديل إلى «حاضر» أو «متأخر» أو «مستأذن» لا يُرسل أي إشعار لولي الأمر.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.

drop policy if exists catt_staff_edit on public.class_attendance;
create policy catt_staff_edit on public.class_attendance
  for update to authenticated
  using (has_any_admin_role(array['principal', 'tech_support', 'deputy', 'deputy_students',
                                  'deputy_academic', 'deputy_school', 'clerk', 'clerk_2',
                                  'clerk_3']::admin_role_type[]))
  with check (has_any_admin_role(array['principal', 'tech_support', 'deputy', 'deputy_students',
                                       'deputy_academic', 'deputy_school', 'clerk', 'clerk_2',
                                       'clerk_3']::admin_role_type[]));
