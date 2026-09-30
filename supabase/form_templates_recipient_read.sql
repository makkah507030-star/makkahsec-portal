-- قراءة قالب المستند لصاحبه: صفحة المستند تجلب حقوله من قالبه (form_templates)،
-- وقراءة القوالب مقصورة على من يُسمح له بإصدارها. فالمعلم الذي وصلته مساءلة
-- غياب لا يقرأ قالبها، فتظهر له «مطلوب إفادتك» بلا حقول يكتب فيها.
-- هذه السياسة تتيح قراءة القالب (لا تعديله) لمن صدر له مستند منه، ولمُصدِره،
-- ولولي أمر الطالب صاحب المستند.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.

drop policy if exists "read template of my documents" on public.form_templates;
create policy "read template of my documents" on public.form_templates
  for select to authenticated
  using (
    exists (
      select 1 from public.form_documents d
      where d.template_id = form_templates.id
        and (d.recipient_user_id = auth.uid()
             or d.created_by = auth.uid()
             or (d.student_id is not null and exists (
                   select 1 from public.guardian_student gs
                   join public.guardians g on g.id = gs.guardian_id
                   where gs.student_id = d.student_id and g.user_id = auth.uid())))
    )
  );
