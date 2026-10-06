-- =====================================================================
-- مسودات النماذج: «حفظ مسودة وإكمالها لاحقًا» ثم الإصدار عند الاكتمال
-- (كاستمارة دعم وتطوير الهيئة التعليمية: يُقيَّم جزء الصف أثناء الزيارة،
--  وتُكمَل الأعمال الإدارية بعد الاطلاع على ملف الإنجاز، ثم تُصدر).
--
-- • حالة جديدة للمستند: draft. يُحجز رقمها التسلسلي عند أول حفظ.
-- • المسودة لا تُربط بحساب المستفيد حتى الإصدار، ولا يراها المستفيد ولا
--   أولياء الأمر حتى لو رُبطت — يراها صاحبها ومدير المدرسة والدعم الفني.
-- • صاحبها يعدّلها ويصدرها (draft ← issued/pending/awaiting_reply) ويحذفها.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

-- ١) السماح بالحالة الجديدة
alter table public.form_documents drop constraint if exists form_documents_status_check;
alter table public.form_documents add constraint form_documents_status_check
  check (status = any (array['draft', 'pending', 'approved', 'rejected', 'issued', 'awaiting_reply', 'replied']));

-- ٢) الإنشاء: المسودة كبقية الحالات المسموحة
drop policy if exists "issue allowed documents" on public.form_documents;
create policy "issue allowed documents" on public.form_documents as permissive for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.form_templates t
      where t.id = form_documents.template_id and t.is_active
        and ((t.allowed_roles && public.my_form_roles()) or public.is_form_manager())
    )
    and status = any (array['draft', 'pending', 'issued', 'awaiting_reply'])
  );

-- ٣) تعديل المسودة وإصدارها — لصاحبها
drop policy if exists "edit own draft" on public.form_documents;
create policy "edit own draft" on public.form_documents as permissive for update to authenticated
  using (created_by = auth.uid() and status = 'draft')
  with check (created_by = auth.uid() and status = any (array['draft', 'pending', 'issued', 'awaiting_reply']));

-- ٤) الحذف: صاحب المستند يحذف ما لم يصدر، ومنه المسودة
drop policy if exists "issuer deletes own unapproved" on public.form_documents;
create policy "issuer deletes own unapproved" on public.form_documents as permissive for delete to authenticated
  using (created_by = auth.uid() and status = any (array['draft', 'awaiting_reply', 'replied', 'pending', 'rejected']));

-- ٥) القراءة: المسودة لصاحبها والإدارة فقط — لا للمستفيد ولا لأولياء الأمر
drop policy if exists "read own or manage all documents" on public.form_documents;
create policy "read own or manage all documents" on public.form_documents as permissive for select to authenticated
  using (
    created_by = auth.uid()
    or public.is_form_manager()
    or (status <> 'draft' and (
      recipient_user_id = auth.uid()
      or (student_id is not null and exists (
        select 1 from public.guardian_student gs
        join public.guardians g on g.id = gs.guardian_id
        where gs.student_id = form_documents.student_id and g.user_id = auth.uid()
      ))
    ))
  );
