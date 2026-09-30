-- أسماء الموقّعين في التقارير المطبوعة (signer_principal، signer_student_deputy،
-- signer_academic_deputy، signer_tech_support) تُحفظ في جدول settings وتُعدَّل من
-- «الإدارة ← أسماء الموقّعين». الكتابة في settings للمدير وحده، فهذه السياسة
-- تسمح للدعم الفني أيضًا بتعديل هذه المفاتيح الأربعة فقط.
-- لا حاجة لإدخال الأسماء هنا: البوابة تعرض الأسماء الحالية حتى أول حفظ.
-- تكرار التنفيذ آمن.

drop policy if exists settings_signers_write on public.settings;
create policy settings_signers_write on public.settings as PERMISSIVE for ALL to authenticated
  using (key like 'signer\_%' and has_admin_role('tech_support'::admin_role_type))
  with check (key like 'signer\_%' and has_admin_role('tech_support'::admin_role_type));
