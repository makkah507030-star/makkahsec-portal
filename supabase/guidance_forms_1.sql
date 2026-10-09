-- =====================================================================
-- نماذج التوجيه الطلابي — الجزء 1 من 3: استدعاء ولي أمر، محضر مقابلة ولي أمر، دراسة حالة فردية.
-- قسم «التوجيه الطلابي» في النماذج، يصدرها موجهو الصفوف ووكيل شؤون الطلاب (والمدير
-- والدعم الفني دائمًا). اسم الطالب وصفه وولي أمره تُعبّأ تلقائيًا. تكرار التنفيذ آمن.
-- =====================================================================
insert into public.form_templates (key, title, category, department, orientation, fields, allowed_roles,
  requires_approval, signature_source, show_stamp, is_active, sort_order)
values ('guidance_guardian_call', 'استدعاء ولي أمر', 'administrative', 'guidance', 'portrait', '[{"name": "recipient", "type": "student", "label": "الطالب", "required": true},
  {"name": "cls", "type": "text", "label": "الصف والفصل", "required": false},
  {"name": "guardian", "type": "text", "label": "ولي الأمر", "required": false},
  {"name": "visit_date", "type": "date", "label": "موعد الحضور", "required": true},
  {"name": "visit_time", "type": "time", "label": "الوقت", "required": false},
  {"name": "reason", "type": "textarea", "label": "سبب الاستدعاء", "required": true, "presets": ["تكرار الغياب بدون عذر.", "تكرار التأخر الصباحي.", "تدني المستوى الدراسي.", "ملاحظات سلوكية تحتاج التعاون.", "مناقشة أمر يخص الطالب."], "presets_append": true},
  {"name": "note", "type": "textarea", "label": "ملاحظة", "required": false, "presets": ["نأمل حضوركم في الموعد المحدد، شاكرين تعاونكم.", "في حال تعذّر الحضور نأمل التواصل مع الموجه الطلابي لتحديد موعد آخر."], "presets_append": true}]'::jsonb,
  array['deputy_students', 'counselor_1', 'counselor_2', 'counselor_3'], false, 'both', false, true, 11)
on conflict (key) do update set title = excluded.title, fields = excluded.fields,
  department = excluded.department, signature_source = excluded.signature_source, updated_at = now();

insert into public.form_templates (key, title, category, department, orientation, fields, allowed_roles,
  requires_approval, signature_source, show_stamp, is_active, sort_order)
values ('guidance_guardian_meeting', 'محضر مقابلة ولي أمر', 'administrative', 'guidance', 'portrait', '[{"name": "recipient", "type": "student", "label": "الطالب", "required": true},
  {"name": "cls", "type": "text", "label": "الصف والفصل", "required": false},
  {"name": "guardian", "type": "text", "label": "ولي الأمر", "required": false},
  {"name": "mobile", "type": "text", "label": "جوال ولي الأمر", "required": false},
  {"name": "meet_date", "type": "date", "label": "تاريخ المقابلة", "required": true},
  {"name": "purpose", "type": "textarea", "label": "سبب المقابلة", "required": true, "presets": ["متابعة غياب الطالب.", "متابعة المستوى الدراسي.", "متابعة السلوك.", "بطلب من ولي الأمر."], "presets_append": true},
  {"name": "discussed", "type": "textarea", "label": "ما نوقش في المقابلة", "required": true},
  {"name": "agreed", "type": "textarea", "label": "ما اتُّفق عليه", "required": false, "presets": ["متابعة ولي الأمر لمذاكرة الطالب يوميًا.", "الالتزام بالحضور المبكر وعدم الغياب بدون عذر.", "التواصل الأسبوعي بين ولي الأمر والموجه الطلابي.", "الاطلاع على نتائج الطالب في البوابة.", "حضور الطالب الحصص العلاجية."], "presets_append": true},
  {"name": "signs", "type": "sign_lines", "label": "التوقيعات", "required": false, "labels": ["ولي الأمر"]}]'::jsonb,
  array['deputy_students', 'counselor_1', 'counselor_2', 'counselor_3'], false, 'both', false, true, 12)
on conflict (key) do update set title = excluded.title, fields = excluded.fields,
  department = excluded.department, signature_source = excluded.signature_source, updated_at = now();

insert into public.form_templates (key, title, category, department, orientation, fields, allowed_roles,
  requires_approval, signature_source, show_stamp, is_active, sort_order)
values ('guidance_case_study', 'دراسة حالة فردية', 'administrative', 'guidance', 'portrait', '[{"name": "recipient", "type": "student", "label": "الطالب", "required": true},
  {"name": "cls", "type": "text", "label": "الصف والفصل", "required": false},
  {"name": "guardian", "type": "text", "label": "ولي الأمر", "required": false},
  {"name": "mobile", "type": "text", "label": "جوال ولي الأمر", "required": false},
  {"name": "study_date", "type": "date", "label": "تاريخ الدراسة", "required": true},
  {"name": "source", "type": "text", "label": "مصدر الحالة", "required": false, "presets": ["إحالة من وكيل شؤون الطلاب", "رصد الموجه الطلابي", "طلب ولي الأمر", "طلب الطالب", "ملاحظة معلم"]},
  {"name": "problem", "type": "textarea", "label": "وصف المشكلة", "required": true},
  {"name": "family", "type": "textarea", "label": "الظروف الأسرية والاجتماعية", "required": false},
  {"name": "study", "type": "textarea", "label": "الجانب الدراسي", "required": false, "presets": ["تدني في بعض المواد.", "ضعف المتابعة والمذاكرة.", "مستوى دراسي جيد."], "presets_append": true},
  {"name": "health", "type": "textarea", "label": "الجانب الصحي والنفسي", "required": false},
  {"name": "causes", "type": "textarea", "label": "الأسباب المحتملة", "required": false},
  {"name": "plan", "type": "textarea", "label": "الخطة العلاجية المقترحة", "required": false, "presets": ["جلسات إرشادية فردية أسبوعية.", "التواصل مع ولي الأمر ومتابعته.", "التنسيق مع معلمي الطالب.", "إشراك الطالب في الأنشطة المدرسية.", "عقد سلوكي بأهداف محددة."], "presets_append": true},
  {"name": "recommend", "type": "textarea", "label": "التوصيات", "required": false}]'::jsonb,
  array['deputy_students', 'counselor_1', 'counselor_2', 'counselor_3'], false, 'both', false, true, 13)
on conflict (key) do update set title = excluded.title, fields = excluded.fields,
  department = excluded.department, signature_source = excluded.signature_source, updated_at = now();
-- نهاية الجزء 1
