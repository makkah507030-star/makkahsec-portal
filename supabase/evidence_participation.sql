-- ربط «شهادة حضور — ورشة تدريبية» (training_attendance) بشاهد الأداء الوظيفي:
-- العنصر ٢ «التفاعل مع المجتمع المهني»، شاهد مباشر لكل فئات المنسوبين.
-- بعدها يظهر للمنسوب في صفحة الشهادة وفي نسختها المطبوعة تنبيه:
--   «يمكنك الاستفادة من هذا النموذج شاهدًا على: التفاعل مع المجتمع المهني».
-- بيانات فقط، لا يحتاج نشرًا. شغّله في Supabase ← SQL Editor، وتكراره آمن.

-- ١) شهادة حضور الورشة التدريبية ← العنصر ٢
insert into public.evidence_links (template_key, category, element, level, note, sort_order)
values ('training_attendance', 'all', 'التفاعل مع المجتمع المهني', 'direct',
        'شهادة حضور الورشة التدريبية باسم المنسوب', 15)
on conflict do nothing;

-- ٢) شهادة شكر وتقدير — معلم أو إداري ← العنصرين ٢ و١ معًا
insert into public.evidence_links (template_key, category, element, level, note, sort_order)
values ('cert_teacher_thanks', 'all', 'التفاعل مع المجتمع المهني', 'direct',
        'شهادة الشكر والتقدير باسم المنسوب', 15),
       ('cert_teacher_thanks', 'all', 'أداء الواجبات الوظيفية', 'direct',
        'شهادة الشكر والتقدير باسم المنسوب', 16)
on conflict do nothing;

-- تأكيد: الربط بعد التنفيذ
select el.template_key as المفتاح, t.title as اسم_النموذج, el.element as العنصر, el.level as نوع_الشاهد
from public.evidence_links el
join public.form_templates t on t.key = el.template_key
where el.template_key in ('training_attendance', 'cert_teacher_thanks')
order by el.template_key, el.sort_order;
-- نهاية الجزء 1
