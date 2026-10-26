-- =====================================================================
-- الكتابة بالصلاحية التفصيلية لا بنوع الحساب — المرحلة 2، الجزء 1 من 1.
-- • الطلاب وأولياء الأمور وربطهما والتسجيل في الفصول: «تعديل السجلات» أو «الاستيراد»؛
--   والجدول الدراسي: «الاستيراد»؛ والإشعارات ومستلموها (الإضافة والحذف): «الإشعارات».
--   دوال الخادم (send_notification وغيرها) لا تتأثر، فهي تعمل بصلاحية الخادم.
-- • كانت سياسات الكتابة في هذه الجداول تشترط «حساب admin» فقط، فأي إداري (أيًّا كان دوره)
--   يكتب فيها مباشرة وإن لم تظهر له صفحتها. صارت الكتابة لمن يملك صلاحية الصفحة
--   (has_permission: المدير والدعم الفني دائمًا، ومن أُسند لدوره المفتاح في role_permissions)،
--   كما تُحسب صلاحيات الصفحات في الواجهة.
-- • القراءة لا تتغير: سياسة ALL العامة تُستبدل بسياسة قراءة بالشرط نفسه، ثم سياسة كتابة بالصلاحية.
-- • تُقرأ السياسات من قاعدة البيانات نفسها (pg_policies)، فلا تعتمد على أسمائها في المستودع.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
do $do$
declare
  m record; p record; who text;
  broad text := 'is_admin\(|''admin''::user_role|''admin''::text|= ''admin''';
begin
  for m in select * from (values
      ('students', 'public.has_permission(''records'') or public.has_permission(''import'')'),
      ('guardians', 'public.has_permission(''records'') or public.has_permission(''import'')'),
      ('guardian_student', 'public.has_permission(''records'') or public.has_permission(''import'')'),
      ('student_enrollment', 'public.has_permission(''records'') or public.has_permission(''import'')'),
      ('schedule', 'public.has_permission(''import'')'),
      ('notifications', 'public.has_permission(''notifications'')'),
      ('notification_recipients', 'public.has_permission(''notifications'')')) as x(t, cond)
  loop
    continue when to_regclass('public.' || m.t) is null;
    for p in select * from pg_policies
              where schemaname = 'public' and tablename = m.t and cmd <> 'SELECT'
                and coalesce(qual, '') || coalesce(with_check, '') ~* broad
                and coalesce(qual, '') || coalesce(with_check, '') !~* 'has_permission|has_admin_role|admin_roles'
                -- سياسات «صفّي أنا» (مثل تعليم الإشعار مقروءًا) تبقى كما هي
                and coalesce(qual, '') || coalesce(with_check, '') !~* 'auth\.uid\(\)'
    loop
      select string_agg(quote_ident(r), ', ') into who from unnest(p.roles) r;
      -- ALL كانت تشمل القراءة: تبقى القراءة بالشرط نفسه
      if p.cmd = 'ALL' and p.qual is not null then
        execute format('drop policy if exists %I on public.%I', left(p.policyname, 50) || '_read', m.t);
        execute format('create policy %I on public.%I for select to %s using (%s)',
                       left(p.policyname, 50) || '_read', m.t, who, p.qual);
      end if;
      execute format('drop policy %I on public.%I', p.policyname, m.t);
    end loop;
    execute format('drop policy if exists %I on public.%I', m.t || '_perm_write', m.t);
    execute format('create policy %I on public.%I for all to authenticated using (%s) with check (%s)',
                   m.t || '_perm_write', m.t, m.cond, m.cond);
  end loop;
end $do$;

-- التحقق: سياسات الكتابة في الجداول السبعة بعد التعديل
select tablename as "الجدول", policyname as "السياسة", cmd as "العملية",
       left(coalesce(with_check, qual), 70) as "الشرط"
  from pg_policies
 where schemaname = 'public' and cmd <> 'SELECT'
   and tablename in ('students', 'guardians', 'guardian_student', 'student_enrollment', 'schedule',
                     'notifications', 'notification_recipients')
 order by 1, 2;
-- نهاية الجزء 1
