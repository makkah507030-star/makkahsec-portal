-- فحص (قراءة فقط): الشواهد المرفوعة مقابل الشواهد المطلوبة في الخطة النشطة لكل مؤشر
select e.code, e.title as "عنوان الشاهد المرفوع",
       (select string_agg(x, ' | ') from jsonb_array_elements_text(to_jsonb(p.evidence)) x) as "المطلوب في الخطة"
  from public.acc_evidence e
  left join public.acc_programs p on p.code = e.code and p.kind = 'plan'
   and p.plan_id = (select id from public.acc_plans order by (status = 'active') desc, created_at desc limit 1)
 order by e.code, e.created_at
 limit 60;
-- نهاية الجزء 1
