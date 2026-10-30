-- =====================================================================
-- فحص للقراءة فقط: لماذا لا تظهر «الشواهد من خارج البوابة» في الملف الرقمي لمعلم.
-- القائمة تعرض ما رفعه المعلم بملف (source = 'upload') في العام النشط فقط، وتختفي إن أخفى المعلم
-- قسم «الشواهد» من إعدادات ملفه. غيّر الاسم في السطر التالي إن لزم.
-- =====================================================================

with t as (select id, full_name from public.users where full_name like '%الفهمي%' and is_active)
select t.full_name,
  (select value from public.settings where key = 'active_year') as "العام النشط",
  d.hidden as "الأقسام المخفية في ملفه",
  d.disabled_at as "الملف موقوف منذ",
  e.academic_year as "عام الشاهد", e.source as "المصدر", count(*) as "العدد",
  count(*) filter (where e.file_path is not null) as "بملف"
from t
left join public.teacher_dfiles d on d.teacher_user_id = t.id
left join public.perf_evidence e on e.teacher_user_id = t.id
group by t.full_name, d.hidden, d.disabled_at, e.academic_year, e.source
order by t.full_name, e.academic_year, e.source;

-- نهاية الجزء 1
