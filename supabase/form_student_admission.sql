-- =====================================================================
-- نموذج «قبول طالب» — خطاب رسمي إلى المدرسة المنقول منها الطالب، بالموافقة
-- على قبوله وطلب ملفه. تصميمه في FormSheet (StudentAdmission) بالمفتاح
-- student_admission.
--
-- • يُصدره مدير المدرسة وحده (والدعم الفني يصل لكل النماذج للدعم)، بتوقيعه
--   والختم، فلا يحتاج اعتمادًا.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor. تكرار التنفيذ لا يكرّر النموذج،
-- ويعيد صلاحية إصداره للمدير وحده.
-- =====================================================================

insert into public.form_templates
  (key, title, category, department, description, orientation, fields,
   allowed_roles, requires_approval, signature_source, show_stamp, is_active, sort_order)
select
  'student_admission',
  'قبول طالب',
  'official',
  'student_affairs',
  'خطاب موافقة على قبول طالب منقول، يُرسل لمدرسته السابقة لطلب ملفه ونقله في نظام نور.',
  'portrait',
  '[
    {"name": "recipient",   "label": "اسم الطالب رباعيًا",          "type": "text",     "required": true},
    {"name": "national_id", "label": "رقم الهوية / الإقامة",         "type": "text",     "required": true},
    {"name": "grade",       "label": "الصف الدراسي",                 "type": "text",     "required": true,
     "presets": ["الأول ثانوي", "الثاني ثانوي", "الثالث ثانوي"]},
    {"name": "academic_year", "label": "العام الدراسي",              "type": "text",     "required": true,
     "default": "@hijri_year"},
    {"name": "from_school", "label": "المدرسة المنقول منها",         "type": "text",     "required": false},
    {"name": "date",        "label": "التاريخ",                      "type": "date",     "required": true},
    {"name": "notes",       "label": "ملاحظات",                      "type": "textarea", "required": false},
    {"name": "extra",       "label": "متطلبات إضافية في ملف الطالب (كل سطر بند)", "type": "textarea", "required": false}
  ]'::jsonb,
  array['principal', 'tech_support'],
  false,
  'principal',
  true,
  true,
  20
on conflict (key) do update
  set allowed_roles = excluded.allowed_roles,
      requires_approval = excluded.requires_approval;

-- للتحقق بعد التنفيذ
select key, title, category, department, allowed_roles, requires_approval, signature_source
from public.form_templates where key = 'student_admission';
