-- توحيد التسمية: «الموظفون» بدل «المنسوبون» في نصوص البوابة المحفوظة في قاعدة البيانات.
-- لا يمسّ النصوص الرسمية المنقولة حرفيًا (قواعد السلوك، ومؤشرات الدليل، وبرنامج «مزايا لمنسوبي التعليم»).
-- يُنفَّذ مرة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.

-- شواهد النماذج في ملف الأداء
update public.evidence_links set note = replace(note, 'منسوب', 'موظف') where note like '%منسوب%';

-- بند المدرسة في عنصر «أداء الواجبات الوظيفية» (بنود الدليل الرسمية لا تُمس)
update public.perf_items set title = replace(title, 'المنسوبين', 'الموظفين') where source = 'school' and title like '%المنسوبين%';

-- خيار جاهز في نموذج «تعهد طالب»
update public.form_templates set fields = replace(fields::text, 'ومنسوبي المدرسة', 'وموظفي المدرسة')::jsonb
 where key = 'guidance_pledge' and fields::text like '%ومنسوبي المدرسة%';

-- وصف المستفيدين في التعاميم المرسلة سابقًا («كل المنسوبين»)
update public.circulars set audience = replace(audience::text, 'المنسوبين', 'الموظفين')::jsonb where audience::text like '%المنسوبين%';
-- نهاية الجزء 1
