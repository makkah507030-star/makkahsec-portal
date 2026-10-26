-- =====================================================================
-- مرفقات تذاكر الدعم في مخزن خاص — الجزء 1 من 1.
-- • كان المخزن عامًّا وسياسة «public read ticket attachments» تتيح لأي أحد قراءة أي مرفق
--   (صور شاشات قد تحوي بيانات شخصية) بمعرفة رابطه.
-- • صار خاصًّا: يقرأ المرفق صاحب التذكرة والدعم الفني (ومن له صلاحية feedback) وحدهم،
--   والبوابة تعرضه برابط مؤقت لساعة (TicketDetail.jsx).
-- يُنفَّذ بعد نشر الدفعة التي فيها عرض المرفقات بالرابط المؤقت، وتكرار التنفيذ آمن.
-- =====================================================================
update storage.buckets set public = false where id = 'ticket-attachments';

drop policy if exists "public read ticket attachments" on storage.objects;
drop policy if exists ticket_attachments_read on storage.objects;
create policy ticket_attachments_read on storage.objects for select to authenticated
  using (bucket_id = 'ticket-attachments' and (
    exists (select 1 from public.feedback f
             where f.id::text = (storage.foldername(name))[1] and f.user_id = auth.uid())
    or exists (select 1 from public.admin_roles ar
                where ar.user_id = auth.uid()
                  and (ar.role_type = 'tech_support'
                       or ar.role_type in (select role_type from public.role_permissions where permission = 'feedback')))));
-- نهاية الجزء 1
