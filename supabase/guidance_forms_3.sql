-- =====================================================================
-- نماذج التوجيه الطلابي — الجزء 3 من 3: خطة علاجية للتأخر الدراسي، إشعار ولي أمر بتدني المستوى، محضر لجنة التوجيه الطلابي.
-- قسم «التوجيه الطلابي» في النماذج، يصدرها موجهو الصفوف ووكيل شؤون الطلاب (والمدير
-- والدعم الفني دائمًا). اسم الطالب وصفه وولي أمره تُعبّأ تلقائيًا. تكرار التنفيذ آمن.
-- =====================================================================
insert into public.form_templates (key, title, category, department, orientation, fields, allowed_roles,
  requires_approval, signature_source, show_stamp, is_active, sort_order)
values ('guidance_academic_plan', 'خطة علاجية للتأخر الدراسي', 'administrative', 'guidance', 'portrait', '[{"name": "recipient", "type": "student", "label": "الطالب", "required": true},
  {"name": "cls", "type": "text", "label": "الصف والفصل", "required": false},
  {"name": "period", "type": "daterange", "label": "مدة الخطة", "required": true},
  {"name": "subjects", "type": "text", "label": "المواد التي يتعثر فيها", "required": true},
  {"name": "signs", "type": "textarea", "label": "مظاهر التأخر", "required": false, "presets": ["تدني الدرجات في الاختبارات القصيرة.", "عدم أداء الواجبات.", "ضعف المشاركة الصفية.", "كثرة الغياب عن الحصص."], "presets_append": true},
  {"name": "causes", "type": "textarea", "label": "الأسباب", "required": false, "presets": ["ضعف التأسيس في المادة.", "ضعف الدافعية للتعلم.", "كثرة الغياب.", "ظروف أسرية.", "ضعف مهارات المذاكرة."], "presets_append": true},
  {"name": "steps", "type": "textarea", "label": "الإجراءات العلاجية", "required": false, "presets": ["حصص علاجية بالتنسيق مع معلم المادة.", "تدريب الطالب على مهارات المذاكرة وتنظيم الوقت.", "إشراكه في مجموعات تعلم مع زملاء متفوقين.", "متابعة الواجبات أسبوعيًا.", "تعزيز الطالب عند التحسن."], "presets_append": true},
  {"name": "guardian_role", "type": "textarea", "label": "دور ولي الأمر", "required": false, "presets": ["متابعة مذاكرة الطالب يوميًا.", "الاطلاع على نتائجه في البوابة.", "التواصل مع معلمي المواد."], "presets_append": true},
  {"name": "evaluation", "type": "textarea", "label": "المتابعة والتقييم", "required": false}]'::jsonb,
  array['deputy_students', 'counselor_1', 'counselor_2', 'counselor_3'], false, 'both', false, true, 17)
on conflict (key) do update set title = excluded.title, fields = excluded.fields,
  department = excluded.department, signature_source = excluded.signature_source, updated_at = now();

insert into public.form_templates (key, title, category, department, orientation, fields, allowed_roles,
  requires_approval, signature_source, show_stamp, is_active, sort_order)
values ('guidance_low_level_notice', 'إشعار ولي أمر بتدني المستوى', 'administrative', 'guidance', 'portrait', '[{"name": "recipient", "type": "student", "label": "الطالب", "required": true},
  {"name": "cls", "type": "text", "label": "الصف والفصل", "required": false},
  {"name": "guardian", "type": "text", "label": "ولي الأمر", "required": false},
  {"name": "notice_date", "type": "date", "label": "التاريخ", "required": true},
  {"name": "subjects", "type": "textarea", "label": "المواد التي تدنّى فيها المستوى", "required": true},
  {"name": "notes", "type": "textarea", "label": "ملاحظات المعلمين", "required": false, "presets": ["تدني الدرجات في الاختبارات القصيرة.", "عدم أداء الواجبات والمهام الأدائية.", "ضعف المشاركة والتفاعل في الحصة.", "كثرة الغياب عن الحصص."], "presets_append": true},
  {"name": "request", "type": "textarea", "label": "المطلوب من ولي الأمر", "required": false, "presets": ["متابعة مذاكرة الطالب يوميًا.", "التواصل مع الموجه الطلابي ومعلمي المواد.", "الاطلاع على نتائج الطالب في البوابة.", "حث الطالب على حضور الحصص العلاجية."], "presets_append": true},
  {"name": "signs", "type": "sign_lines", "label": "التوقيعات", "required": false, "labels": ["ولي الأمر (بالاطلاع)"]}]'::jsonb,
  array['deputy_students', 'counselor_1', 'counselor_2', 'counselor_3'], false, 'both', false, true, 18)
on conflict (key) do update set title = excluded.title, fields = excluded.fields,
  department = excluded.department, signature_source = excluded.signature_source, updated_at = now();

insert into public.form_templates (key, title, category, department, orientation, fields, allowed_roles,
  requires_approval, signature_source, show_stamp, is_active, sort_order)
values ('guidance_committee', 'محضر لجنة التوجيه الطلابي', 'administrative', 'guidance', 'portrait', '[{"name": "committee", "type": "text", "label": "الجهة أو اللجنة", "required": true, "presets": ["لجنة التوجيه الطلابي"]},
  {"name": "number", "type": "text", "label": "رقم الاجتماع", "required": false},
  {"name": "date", "type": "date", "label": "تاريخ الاجتماع", "required": true},
  {"name": "time", "type": "timerange", "label": "وقت الاجتماع", "required": false},
  {"name": "place", "type": "text", "label": "مكان الاجتماع", "required": false, "presets": ["قاعة الاجتماعات", "مكتب مدير المدرسة", "مركز مصادر التعلم", "عن بُعد (منصة مدرستي)"]},
  {"name": "chair", "type": "text", "label": "رئيس الاجتماع", "required": true},
  {"name": "secretary", "type": "text", "label": "مقرر الاجتماع", "required": false},
  {"name": "agenda", "type": "textarea", "label": "جدول الأعمال (سطر لكل محور)", "required": true, "presets_append": true, "presets": ["متابعة توصيات الاجتماع السابق.", "دراسة حالات الطلاب المحالين.", "متابعة الخطط العلاجية السلوكية والدراسية.", "متابعة الطلاب المتجاوزين لحدود الغياب.", "البرامج الإرشادية والوقائية للفترة القادمة.", "ما يستجد من أعمال."]},
  {"name": "discussion", "type": "textarea", "label": "ما نوقش في الاجتماع", "required": false},
  {"name": "decisions", "type": "textarea", "label": "القرارات والتوصيات (سطر لكل توصية: التوصية | الجهة المنفذة | مدة التنفيذ)", "required": true, "presets_append": true, "presets": ["دراسة حالة الطالب ووضع خطة علاجية | الموجه الطلابي | أسبوعان", "استدعاء ولي الأمر ومقابلته | الموجه الطلابي | أسبوع", "نقل الطالب إلى فصل آخر | وكيل شؤون الطلاب | فورًا", "إحالة الحالة لجهة مختصة | مدير المدرسة | أسبوع", "تنفيذ برنامج وقائي للطلاب | الموجه الطلابي | شهر"]},
  {"name": "attendees", "type": "table", "label": "الحاضرون", "required": false, "columns": ["م", "الاسم", "الصفة", "التوقيع"], "rows": 10}]'::jsonb,
  array['deputy_students', 'counselor_1', 'counselor_2', 'counselor_3'], false, 'principal', false, true, 19)
on conflict (key) do update set title = excluded.title, fields = excluded.fields,
  department = excluded.department, signature_source = excluded.signature_source, updated_at = now();
-- نهاية الجزء 3
