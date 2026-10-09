-- =====================================================================
-- التطوير المهني (الجزء 2ب): ربط ثلاثة معلمين اختلف إملاء أسمائهم في البوابة
-- عن القائمة الورقية، فلم يطابقهم الجزء 2. تكرار التنفيذ آمن.
-- =====================================================================

insert into public.department_members (department_id, teacher_id, is_head)
select d.id, v.teacher_id::uuid, v.is_head
  from (values
    ('الرياضيات',                                 'd8302af9-7d17-439f-a95c-67a8ba7675b8', true),   -- فايز عايض سرحى العتيبي
    ('التربية البدنية',                           'f98d0197-e561-47b9-bdd1-b59e977f6cd7', true),   -- ياسر بن كنيظب بن عبيد الحربى
    ('التقنية الرقمية والعلوم الإدارية والنفسية', '000e37c0-f49a-4201-ba4d-9f286b96c552', false)   -- ابوبكر عبدالرحيم ابوبكر باقيس
  ) as v(dept, teacher_id, is_head)
  join public.departments d on d.name = v.dept
on conflict (teacher_id) do update
  set department_id = excluded.department_id, is_head = excluded.is_head;

-- للتحقق: رؤساء الأقسام العشرة
select d.name as "القسم", t.full_name as "الرئيس"
  from public.departments d
  left join public.department_members m on m.department_id = d.id and m.is_head
  left join public.teachers t on t.id = m.teacher_id
 order by d.sort_order;
-- نهاية الجزء 2ب
