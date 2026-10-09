-- =====================================================================
-- «محضر اجتماع» بالصيغة الرسمية (FormSheet.jsx ← MeetingMinutes): بيانات
-- الاجتماع، وجدول الأعمال، وما نوقش، والقرارات والتوصيات، وجدول الحاضرين
-- للتوقيع، وتوقيع المقرر والرئيس واعتماد مدير المدرسة. يصدره كل الإداريين
-- والمعلمون. تكرار التنفيذ آمن، ويُحدّث حقوله إن وُجد.
-- =====================================================================
insert into public.form_templates
  (key, title, category, department, orientation, fields, allowed_roles,
   requires_approval, signature_source, show_stamp, is_active, sort_order, description)
select 'meeting_minutes', 'محضر اجتماع', 'administrative', 'school_admin', 'portrait', '[]'::jsonb,
       array['admin', 'teacher'], false, 'principal', false, true, 20,
       'محضر اجتماع بالصيغة الرسمية: بياناته وجدول أعماله وقراراته وتوقيع الحاضرين'
where not exists (select 1 from public.form_templates where key = 'meeting_minutes');

update public.form_templates set fields = '[
  {"name": "committee", "type": "text", "label": "الجهة أو اللجنة", "required": true,
   "presets": ["مجلس المدرسة", "مجلس المعلمين", "لجنة التميز المدرسي", "لجنة التوجيه والإرشاد",
               "لجنة الانضباط المدرسي", "لجنة الاختبارات", "لجنة الأمن والسلامة", "مجتمع التعلم المهني"]},
  {"name": "number", "type": "text", "label": "رقم الاجتماع", "required": false},
  {"name": "date", "type": "date", "label": "تاريخ الاجتماع", "required": true},
  {"name": "time", "type": "timerange", "label": "وقت الاجتماع", "required": false},
  {"name": "place", "type": "text", "label": "مكان الاجتماع", "required": false,
   "presets": ["قاعة الاجتماعات", "مكتب مدير المدرسة", "مركز مصادر التعلم", "عن بُعد (منصة مدرستي)"]},
  {"name": "chair", "type": "text", "label": "رئيس الاجتماع", "required": true},
  {"name": "secretary", "type": "text", "label": "مقرر الاجتماع", "required": false},
  {"name": "agenda", "type": "textarea", "label": "جدول الأعمال (سطر لكل محور)", "required": true, "presets_append": true,
   "presets": ["افتتاح الاجتماع ومتابعة توصيات الاجتماع السابق.", "مناقشة نتائج الطلاب وخطط العلاج والإثراء.",
               "متابعة الانضباط والمواظبة.", "الاستعداد للاختبارات.", "خطة الأنشطة والبرامج للفترة القادمة.", "ما يستجد من أعمال."]},
  {"name": "discussion", "type": "textarea", "label": "ما نوقش في الاجتماع", "required": false},
  {"name": "decisions", "type": "textarea", "label": "القرارات والتوصيات (سطر لكل توصية: التوصية | الجهة المنفذة | مدة التنفيذ)", "required": true,
   "presets_append": true,
   "presets": ["تنفيذ الخطط العلاجية للطلاب المتعثرين | المعلمون | أسبوعان",
               "تكريم الطلاب المتفوقين | وكيل شؤون الطلاب | نهاية الفترة",
               "متابعة الغياب والتأخر الصباحي | وكيل شؤون الطلاب | مستمر",
               "تبادل الزيارات بين المعلمين | رؤساء الأقسام | شهر",
               "رفع التقرير لمدير المدرسة | مقرر الاجتماع | أسبوع"]},
  {"name": "attendees", "type": "table", "label": "الحاضرون", "required": false,
   "columns": ["م", "الاسم", "الصفة", "التوقيع"], "rows": 10}
]'::jsonb, updated_at = now()
where key = 'meeting_minutes';
-- نهاية الملف
