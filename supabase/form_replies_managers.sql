-- ردود المستفيدين للمدير والدعم الفني: يرون كل المساءلات بانتظار الإفادة أو
-- المُرسَلة إفاداتها (لا ما أصدروه وحده)، ويعتمدونها أو يعيدونها بملاحظة.
-- المدير يملك ذلك أصلًا (approver decides)، وهذه تضيف الدعم الفني، ولحالتي
-- الإفادة فقط (awaiting_reply وreplied) — لا تمس اعتماد النماذج الأخرى.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.

drop policy if exists "managers handle replies" on public.form_documents;
create policy "managers handle replies" on public.form_documents
  for update to authenticated
  using (is_form_manager() and status in ('awaiting_reply', 'replied'))
  with check (is_form_manager() and status in ('awaiting_reply', 'replied', 'issued'));
