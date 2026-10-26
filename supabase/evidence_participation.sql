-- ربط «شهادة المشاركة» في النماذج بشاهد الأداء الوظيفي:
-- العنصر ٢ «التفاعل مع المجتمع المهني»، شاهد مباشر لكل فئات المنسوبين.
-- بعدها يظهر للمنسوب في صفحة الشهادة وفي نسختها المطبوعة تنبيه:
--   «يمكنك الاستفادة من هذا النموذج شاهدًا على: التفاعل مع المجتمع المهني».
-- بيانات فقط، لا يحتاج نشرًا. شغّله في Supabase ← SQL Editor، وتكراره آمن.

-- يربط كل نموذج شهادة اسمه فيه «مشارك» (شهادة المشاركة/شهادة شكر ومشاركة…)
insert into public.evidence_links (template_key, category, element, level, note, sort_order)
select key, 'all', 'التفاعل مع المجتمع المهني', 'direct',
       'شهادة المشاركة الموقعة باسم المنسوب', 15
from public.form_templates
where category = 'certificate' and title like '%مشارك%'
on conflict do nothing;

-- تأكيد (١): ما رُبط فعلًا الآن
select el.template_key as المفتاح, t.title as اسم_النموذج, el.element as العنصر
from public.evidence_links el
join public.form_templates t on t.key = el.template_key
where el.element = 'التفاعل مع المجتمع المهني'
  and el.note = 'شهادة المشاركة الموقعة باسم المنسوب';

-- تأكيد (٢): كل نماذج الشهادات — إن لم يُربط المطلوب أعلاه فانسخ لي
--           مفتاح «شهادة المشاركة» من هذه القائمة لأضبط الربط عليه.
select key as المفتاح, title as اسم_النموذج
from public.form_templates
where category = 'certificate' and is_active
order by sort_order;
-- نهاية الجزء 1
