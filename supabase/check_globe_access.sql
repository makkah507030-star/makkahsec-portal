-- =====================================================================
-- فحص للقراءة فقط: هل يصل حساب «برنامج جلوب البيئي العالمي» إلى كل طلاب المدرسة؟
-- يحاكي دخول الحساب نفسه (بصلاحيات المسجّل) ويعدّ ما يراه، مقابل العدد الكامل.
-- لا يغيّر شيئًا. يُنفَّذ كاملًا دفعة واحدة في Supabase ← SQL Editor.
-- =====================================================================
-- العدد الكامل وهوية الحساب قبل المحاكاة
select set_config('chk.total_students', (select count(*) from public.students where is_active)::text, true),
       set_config('chk.total_enroll', (select count(*) from public.student_enrollment where status = 'active')::text, true),
       set_config('chk.uid', (select ar.user_id::text from public.admin_roles ar
                               where ar.role_type = 'globe_program' limit 1), true),
       set_config('chk.info', (select u.username || ' · ' || coalesce(u.full_name, '') || ' · نوع الحساب: ' || u.role
                                      || case when u.is_active then '' else ' (موقوف)' end
                                      || ' · معلم: ' || case when exists (select 1 from public.teachers t where t.user_id = u.id)
                                                             then 'نعم' else 'لا' end
                                 from public.admin_roles ar join public.users u on u.id = ar.user_id
                                where ar.role_type = 'globe_program' limit 1), true),
       set_config('chk.perms', coalesce((select string_agg(permission, '، ' order by permission)
                                           from public.role_permissions where role_type = 'globe_program'), 'لا شيء'), true);

-- الدخول بهوية الحساب (داخل هذا التنفيذ فقط)
select set_config('request.jwt.claims',
                  json_build_object('sub', current_setting('chk.uid'), 'role', 'authenticated')::text, true);
set local role authenticated;

select 'الحساب' as "البند", current_setting('chk.info') as "النتيجة"
union all select 'صلاحيات دوره', current_setting('chk.perms')
union all select 'الطلاب الذين يراهم',
       (select count(*) from public.students where is_active) || ' من ' || current_setting('chk.total_students')
union all select 'تسجيلات الفصول التي يراها (اختيار الطلاب في الأحداث)',
       (select count(*) from public.student_enrollment where status = 'active') || ' من ' || current_setting('chk.total_enroll')
union all select 'الفصول التي يراها', (select count(*) from public.classes)::text
union all select 'النتيجة',
       case when (select count(*) from public.students where is_active)::text = current_setting('chk.total_students')
            then 'سليم: يصل إلى كل طلاب المدرسة'
            else 'ناقص: يرى بعض الطلاب فقط' end;
-- نهاية الجزء 1
