-- =====================================================================
-- بوابة مركز تحليل النتائج: مفتاح يفتح/يغلق المركز حتى اكتمال رصد الدرجات.
-- settings.ach_center_enabled = "true" (مفتوح) / غيرها (مغلق، وهو الافتراضي).
--
-- سياسة settings_write تسمح لمدير المدرسة وحده بالكتابة في الإعدادات.
-- هنا نضيف سياسة تسمح أيضًا لوكيل الشؤون التعليمية والدعم الفني بتغيير
-- هذا المفتاح وحده (كما سياسة توقيعات الدعم الفني)، فيفتحه الوكيل بنفسه.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار تنفيذه آمن.
-- =====================================================================

drop policy if exists settings_ach_gate_write on public.settings;
create policy settings_ach_gate_write on public.settings as permissive for all to authenticated
  using (
    key = 'ach_center_enabled'
    and (public.has_admin_role('deputy_academic'::public.admin_role_type)
      or public.has_admin_role('tech_support'::public.admin_role_type))
  )
  with check (
    key = 'ach_center_enabled'
    and (public.has_admin_role('deputy_academic'::public.admin_role_type)
      or public.has_admin_role('tech_support'::public.admin_role_type))
  );
-- نهاية الجزء 1
