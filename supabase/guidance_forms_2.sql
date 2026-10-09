-- =====================================================================
-- نماذج التوجيه الطلابي — الجزء 2 من 3: محضر جلسة إرشادية، تعهد طالب، خطة علاجية سلوكية.
-- قسم «التوجيه الطلابي» في النماذج، يصدرها موجهو الصفوف ووكيل شؤون الطلاب (والمدير
-- والدعم الفني دائمًا). اسم الطالب وصفه وولي أمره تُعبّأ تلقائيًا. تكرار التنفيذ آمن.
-- =====================================================================
insert into public.form_templates (key, title, category, department, orientation, fields, allowed_roles,
  requires_approval, signature_source, show_stamp, is_active, sort_order)
values ('guidance_session', 'محضر جلسة إرشادية', 'administrative', 'guidance', 'portrait', '[{"name": "recipient", "type": "student", "label": "الطالب", "required": true},
  {"name": "cls", "type": "text", "label": "الصف والفصل", "required": false},
  {"name": "session_date", "type": "date", "label": "تاريخ الجلسة", "required": true},
  {"name": "kind", "type": "text", "label": "نوع الجلسة", "required": false, "presets": ["فردية", "جماعية", "مع ولي الأمر"]},
  {"name": "session_no", "type": "number", "label": "رقم الجلسة", "required": false},
  {"name": "goal", "type": "textarea", "label": "هدف الجلسة", "required": true, "presets": ["بناء علاقة إرشادية مع الطالب.", "تحديد المشكلة وأسبابها.", "تعديل سلوك محدد.", "رفع الدافعية للتعلم.", "متابعة التقدم وتقييمه."], "presets_append": true},
  {"name": "done", "type": "textarea", "label": "ما تم في الجلسة", "required": true},
  {"name": "methods", "type": "textarea", "label": "الأساليب الإرشادية المستخدمة", "required": false, "presets": ["الحوار والمناقشة.", "التعزيز الإيجابي.", "العقد السلوكي.", "حل المشكلات.", "لعب الأدوار.", "الاسترخاء وإدارة الضغوط."], "presets_append": true},
  {"name": "tasks", "type": "textarea", "label": "المهام المطلوبة من الطالب", "required": false},
  {"name": "next_date", "type": "date", "label": "موعد الجلسة القادمة", "required": false}]'::jsonb,
  array['deputy_students', 'counselor_1', 'counselor_2', 'counselor_3'], false, 'issuer', false, true, 14)
on conflict (key) do update set title = excluded.title, fields = excluded.fields,
  department = excluded.department, signature_source = excluded.signature_source, updated_at = now();

insert into public.form_templates (key, title, category, department, orientation, fields, allowed_roles,
  requires_approval, signature_source, show_stamp, is_active, sort_order)
values ('guidance_pledge', 'تعهد طالب', 'administrative', 'guidance', 'portrait', '[{"name": "recipient", "type": "student", "label": "الطالب", "required": true},
  {"name": "cls", "type": "text", "label": "الصف والفصل", "required": false},
  {"name": "pledge_date", "type": "date", "label": "التاريخ", "required": true},
  {"name": "pledge", "type": "textarea", "label": "نص التعهد", "required": true, "presets": ["أتعهد بالالتزام بالحضور وعدم الغياب بدون عذر مقبول.", "أتعهد بالحضور المبكر إلى المدرسة وحضور الاصطفاف الصباحي.", "أتعهد بالالتزام بأنظمة المدرسة وتعليماتها.", "أتعهد باحترام زملائي ومعلمي ومنسوبي المدرسة.", "أتعهد بالمحافظة على ممتلكات المدرسة.", "وفي حال تكرار ذلك يحق للمدرسة اتخاذ الإجراءات النظامية وفق دليل السلوك والمواظبة."], "presets_append": true},
  {"name": "signs", "type": "sign_lines", "label": "التوقيعات", "required": false, "labels": ["الطالب", "ولي الأمر"]}]'::jsonb,
  array['deputy_students', 'counselor_1', 'counselor_2', 'counselor_3'], false, 'issuer', false, true, 15)
on conflict (key) do update set title = excluded.title, fields = excluded.fields,
  department = excluded.department, signature_source = excluded.signature_source, updated_at = now();

insert into public.form_templates (key, title, category, department, orientation, fields, allowed_roles,
  requires_approval, signature_source, show_stamp, is_active, sort_order)
values ('guidance_behavior_plan', 'خطة علاجية سلوكية', 'administrative', 'guidance', 'portrait', '[{"name": "recipient", "type": "student", "label": "الطالب", "required": true},
  {"name": "cls", "type": "text", "label": "الصف والفصل", "required": false},
  {"name": "period", "type": "daterange", "label": "مدة الخطة", "required": true},
  {"name": "target", "type": "textarea", "label": "السلوك المستهدف بالتعديل", "required": true, "presets": ["التأخر الصباحي المتكرر.", "الغياب بدون عذر.", "إعاقة سير الحصص.", "الشجار مع الزملاء.", "عدم احترام الأنظمة المدرسية."], "presets_append": true},
  {"name": "desired", "type": "textarea", "label": "السلوك المرغوب", "required": false},
  {"name": "steps", "type": "textarea", "label": "الإجراءات والأساليب", "required": false, "presets": ["جلسات إرشادية فردية.", "عقد سلوكي بين الطالب والموجه.", "التعزيز عند ظهور السلوك المرغوب.", "تكليف الطالب بمهام قيادية.", "التنسيق مع المعلمين لمتابعة السلوك."], "presets_append": true},
  {"name": "guardian_role", "type": "textarea", "label": "دور ولي الأمر", "required": false, "presets": ["متابعة الطالب في المنزل.", "التواصل الأسبوعي مع الموجه الطلابي.", "تعزيز الطالب عند التحسن."], "presets_append": true},
  {"name": "teachers_role", "type": "textarea", "label": "دور المعلمين", "required": false},
  {"name": "indicators", "type": "textarea", "label": "مؤشرات النجاح", "required": false},
  {"name": "evaluation", "type": "textarea", "label": "التقييم بعد التنفيذ", "required": false}]'::jsonb,
  array['deputy_students', 'counselor_1', 'counselor_2', 'counselor_3'], false, 'both', false, true, 16)
on conflict (key) do update set title = excluded.title, fields = excluded.fields,
  department = excluded.department, signature_source = excluded.signature_source, updated_at = now();
-- نهاية الجزء 2
