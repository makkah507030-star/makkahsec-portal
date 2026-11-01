-- =====================================================================
-- أنواع التقويم في سجل المتابعة بأنواعها الحقيقية: يستبدل fu_klabel من perf_fu_labels_1.sql.
-- بنود السجل الثالث المقسومة من عمود واحد (اختبار الوحدة 1، 2، 3…) نوع واحد باسم عمود نور،
-- وبنود عمود المهام الأدائية بأسمائها بلا رقمها الأخير. فلا يُعدّ القسم الواحد أنواعًا.
-- يُنفَّذ بعد ملفات perf_fu_labels الثلاثة. تكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.fu_klabel(p_tid uuid, p_key text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    case regexp_replace(p_key, '^r[23]_', '')
      when 'homework' then 'الواجبات' when 'participation' then 'المشاركة' when 'classwork' then 'التطبيقات الصفية'
      when 'written' then 'نظري' when 'practical' then 'عملي' end,
    (select case when c.lbl like 'المهام الأدائية%'
                 then nullif(trim(regexp_replace(it->>'label', '[[:space:]0-9٠-٩]+$', '')), '')
                 else nullif(c.lbl, '') end
       from teacher_follow_up_dist3 d
       cross join lateral jsonb_each(coalesce(d.weights->'dists', '{}'::jsonb)) e
       cross join lateral jsonb_array_elements(case when jsonb_typeof(e.value) = 'array' then e.value else '[]'::jsonb end) it
       -- عمود نور للبند من بنية الأعمدة (المفتاح «الاسم:السقف|الاسم:السقف…») بترتيبه col
       cross join lateral (select trim(regexp_replace(split_part(e.key, '|', (it->>'col')::int + 1), ':[0-9.]+$', '')) as lbl
                            where coalesce(it->>'col', '') ~ '^[0-9]+$') c
      where p_key like 'r3\_%' and d.teacher_id = p_tid and it->>'id' = substr(p_key, 4)
      order by d.updated_at desc limit 1),
    'بند آخر');
$$;
revoke all on function public.fu_klabel(uuid, text) from public, anon, authenticated;

-- نهاية الجزء 1
