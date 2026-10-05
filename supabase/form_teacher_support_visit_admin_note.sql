-- =====================================================================
-- «استمارة دعم وتطوير الهيئة التعليمية» — تعديل نص طريقة تقييم
-- «أعمال إدارية ومكتبية» (حذف كلمة «الإلكتروني»):
--   سيتم التقييم بعد الاطلاع على ملف إنجاز المعلم وملف الشواهد.
--
-- يغيّر نص الحقل rb_admin وحده دون المساس ببقية الحقول.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

update public.form_templates t
set fields = (
      select jsonb_agg(
               case when f->>'name' = 'rb_admin'
                    then jsonb_set(f, '{note}', to_jsonb('سيتم التقييم بعد الاطلاع على ملف إنجاز المعلم وملف الشواهد.'::text))
                    else f end
               order by o)
      from jsonb_array_elements(t.fields) with ordinality as x(f, o)
    ),
    updated_at = now()
where exists (select 1 from jsonb_array_elements(t.fields) f where f->>'name' = 'rb_admin');

-- للتحقق: النص الجديد
select title, f->>'note' as note
from public.form_templates, jsonb_array_elements(fields) f
where f->>'name' = 'rb_admin';
