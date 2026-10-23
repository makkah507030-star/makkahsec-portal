-- =====================================================================
-- «شهادة حضور — ورشة تدريبية» في النماذج والشهادات، بتصميم شهادات البوابة (FormSheet ← Certificate):
-- تشهد المدرسة بحضور المنسوب ورشة تدريبية، وعنوان الورشة يُكتب يدويًا، ومعه الجهة المشرفة وعدد
-- الساعات وما اكتسبه المتدرب. تصدر بتوقيع مدير المدرسة والختم، ولعدة منسوبين دفعة واحدة.
-- يصدرها المدير والدعم الفني والوكلاء. تكرار التنفيذ آمن، ويُحدّث حقوله إن وُجد.
-- =====================================================================
insert into public.form_templates
  (key, title, category, department, orientation, fields, allowed_roles,
   requires_approval, signature_source, show_stamp, is_active, sort_order, description)
select 'training_attendance', 'شهادة حضور — ورشة تدريبية', 'certificate', 'school_admin', 'landscape', '[]'::jsonb,
       array['deputy_academic', 'deputy_school', 'deputy_students'], false, 'principal', true, true, 16,
       'تشهد المدرسة بحضور المعلم أو الإداري ورشة تدريبية، بعنوان يُكتب يدويًا'
where not exists (select 1 from public.form_templates where key = 'training_attendance');

update public.form_templates set fields = '[
  {"name": "theme", "type": "theme", "label": "تصميم الشهادة", "required": false},
  {"name": "recipient", "type": "staff", "label": "المتدرب (المعلم أو الإداري)", "required": true},
  {"name": "national_id", "type": "text", "label": "رقم الهوية الوطنية", "required": false},
  {"name": "workshop", "type": "text", "label": "عنوان الورشة", "required": true},
  {"name": "program", "type": "textarea", "label": "البرنامج والجهة المشرفة (اختياري)", "required": false,
   "presets": ["ضمن مشروع الثمان الأولى (المسعف المدرسي) بإشراف الإدارة العامة لتطوير الموارد البشرية وإدارة الشؤون الصحية بوزارة التعليم",
               "بإشراف الإدارة العامة للتعليم بمنطقة مكة المكرمة",
               "ضمن برنامج التطوير المهني بالمدرسة"]},
  {"name": "hours", "type": "text", "label": "عدد الساعات التدريبية", "required": false, "default": "5"},
  {"name": "reason", "type": "textarea", "label": "ما اكتسبه المتدرب (اختياري)", "required": false,
   "presets": ["حيث تم خلالها اكتساب المعارف والمهارات الأساسية اللازمة للتعامل مع الحالات الطارئة في مدارس التعليم العام وتقديم الإسعافات الأولية بشكل صحيح وآمن.",
               "حيث تم خلالها اكتساب المعارف والمهارات المرتبطة بموضوع الورشة وتطبيقها عمليًا."]},
  {"name": "closing", "type": "text", "label": "الخاتمة", "required": false,
   "default": "وقد أُعطيت هذه الشهادة تقديرًا لمشاركته والتزامه خلال فترة التدريب.",
   "presets": ["وقد أُعطيت هذه الشهادة تقديرًا لمشاركته والتزامه خلال فترة التدريب.",
               "وقد أُعطيت هذه الشهادة تقديرًا لمشاركتها والتزامها خلال فترة التدريب."]},
  {"name": "date", "type": "date", "label": "تاريخ الإصدار", "required": true}
]'::jsonb, updated_at = now()
where key = 'training_attendance';
-- نهاية الجزء 1
