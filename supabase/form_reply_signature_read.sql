-- =====================================================================
-- إظهار توقيع المستفيد (إقرار المعلم) لمن يحق له رؤية المستند
--
-- المشكلة: في «استمارة دعم وتطوير الهيئة التعليمية» لا يظهر توقيع المعلم
-- عند الوكيل، ويظهر عند الدعم الفني والمدير.
-- السبب: سياسة «read form assets» على حاوية form-assets لا تسمح إلا بملفات
-- المدرسة، أو مجلد المستخدم نفسه، أو لمديري النماذج (الدعم والمدير)؛ وتوقيع
-- المعلم في مجلده هو، فيُرفض رابطه للوكيل فيظهر المربع فارغًا.
--
-- الحل: سياسة إضافية تسمح بقراءة ملف التوقيع متى كان مسجّلًا توقيعًا في
-- مستند يراه المستخدم. الاستعلام على form_documents يخضع لصلاحياتها، فلا
-- يرى أحد إلا توقيعات المستندات التي يحق له فتحها (مُصدِرها أو مستلمها...).
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

drop policy if exists "read signatures of visible documents" on storage.objects;
create policy "read signatures of visible documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'form-assets'
    and exists (
      select 1 from public.form_documents d
      where d.reply_signature_path = objects.name
         or d.signature_path = objects.name
    )
  );

-- نهاية الجزء 1
