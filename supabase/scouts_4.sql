-- =====================================================================
-- الفريق الكشفي (الجزء 4): جوال الطالب نفسه للتواصل العاجل وخارج الدوام
-- (اتصال وواتساب من صفحة الفريق). يُدخله القائد الكشفي أو نائبه (صلاحية
-- «الفريق الكشفي») ويُحفظ بصيغة 966XXXXXXXXX. يُنفَّذ بعد scouts_3.sql،
-- وتكرار تنفيذه آمن. الكتابة تحكمها سياسة scout_members_write القائمة.
-- =====================================================================

alter table public.scout_members add column if not exists student_mobile text;
alter table public.scout_members drop constraint if exists scout_members_student_mobile_check;
alter table public.scout_members add constraint scout_members_student_mobile_check
  check (student_mobile is null or student_mobile ~ '^9665[0-9]{8}$');

-- للتحقق
select count(*) as members, count(student_mobile) as with_mobile from public.scout_members;

-- نهاية الجزء 1
