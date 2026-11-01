-- =====================================================================
-- أسماء بنود سجل المتابعة الإلكتروني في شواهد الأداء (الجزء 1 من 3): fu_klabel.
-- كانت أنواع التقويم تُعدّ بمفاتيحها، فيُعدّ النوع مرتين (homework وr3_homework) وتظهر بنود
-- السجل الثالث المخصّصة بمعرّفاتها البرمجية (r3_cf1draj). هنا اسم كل بند بالعربية من أي سجل:
-- البنود المعروفة بأسمائها، وبنود السجل الثالث بالاسم الذي كتبه المعلم في توزيعه.
-- يُنفَّذ قبل الجزأين 2 و3. تكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.fu_klabel(p_tid uuid, p_key text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    case regexp_replace(p_key, '^r[23]_', '')
      when 'homework' then 'الواجبات' when 'participation' then 'المشاركة' when 'classwork' then 'التطبيقات الصفية'
      when 'written' then 'نظري' when 'practical' then 'عملي' end,
    (select nullif(trim(it->>'label'), '')
       from teacher_follow_up_dist3 d
       cross join lateral jsonb_each(coalesce(d.weights->'dists', '{}'::jsonb)) e
       cross join lateral jsonb_array_elements(case when jsonb_typeof(e.value) = 'array' then e.value else '[]'::jsonb end) it
      where p_key like 'r3\_%' and d.teacher_id = p_tid and it->>'id' = substr(p_key, 4)
      order by d.updated_at desc limit 1),
    'بند آخر');
$$;
revoke all on function public.fu_klabel(uuid, text) from public, anon, authenticated;

-- نهاية الجزء 1
