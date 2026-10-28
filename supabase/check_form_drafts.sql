-- =====================================================================
-- قراءة فقط: مسودات النماذج والشهادات — عددها وعمرها ومن أنشأها، وأثرها على الأرقام التسلسلية.
-- المسودة تحجز رقمها التسلسلي عند أول حفظ؛ فالمسودة المهجورة أو المحذوفة تترك فجوة
-- في تسلسل الأرقام الرسمية للفئة (مثل CER-1448-0135 ثم 0137).
-- يُنفَّذ في Supabase ← SQL Editor.
-- =====================================================================
with d as (
  select fd.*, ft.category, ft.title as tpl
    from public.form_documents fd join public.form_templates ft on ft.id = fd.template_id
   where fd.status = 'draft'
)
select 'المسودات' as "البند",
       count(*)::text as "العدد",
       count(*) filter (where created_at < now() - interval '7 days')::text || ' أقدم من أسبوع · '
         || count(*) filter (where created_at < now() - interval '30 days') || ' أقدم من شهر' as "العمر",
       count(distinct created_by)::text || ' منشئًا' as "المنشئون"
  from d
union all
select 'أكثر النماذج مسودات',
       (select string_agg(tpl || ': ' || n, ' · ') from (select tpl, count(*) n from d group by tpl order by 2 desc limit 5) x),
       '', ''
union all
select 'أكثر المنشئين مسودات',
       (select string_agg(coalesce(u.full_name, '—') || ': ' || n, ' · ')
          from (select created_by, count(*) n from d group by created_by order by 2 desc limit 5) x
          left join public.users u on u.id = x.created_by),
       '', ''
union all
select 'أرقام محجوزة لمسودات بين الأرقام الصادرة (فجوات في التسلسل)',
       count(*)::text, '', ''
  from d
 where exists (select 1 from public.form_documents i join public.form_templates t on t.id = i.template_id
                where t.category = d.category and i.hijri_year = d.hijri_year and i.status <> 'draft'
                  and i.serial > d.serial);
-- نهاية الجزء 1
