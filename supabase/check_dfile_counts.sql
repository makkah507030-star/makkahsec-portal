-- =====================================================================
-- فحص للقراءة فقط: من أين يأتي عدد شواهد كل عنصر في ملف المعلم الرقمي.
-- عدد العنصر = مجموع أعداد بنوده الآلية؛ والعمل الواحد (كالاختبار) قد يُعدّ في أكثر من بند.
-- اكتب جزءًا من اسم المعلم في السطر التالي بدل «الفهمي».
-- =====================================================================
with t as (select u.id, u.full_name from public.users u join public.teachers tt on tt.user_id = u.id
            where u.full_name like '%الفهمي%' and u.is_active limit 1)
select t.full_name as "المعلم", left(c.item_key, 3) as "العنصر", c.item_key as "البند", c.cnt as "العدد"
from t cross join lateral public.perf_auto_counts_core(t.id, (select value from public.settings where key = 'active_year')) c
where left(c.item_key, 3) in ('e03', 'e11')
order by 2, 3;

-- نهاية الجزء 1
