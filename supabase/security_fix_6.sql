-- =====================================================================
-- الكتابة بالصلاحية التفصيلية لا بنوع الحساب — المرحلة 1، الجزء 1 من 1.
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
      ('student_results', 'results'), ('period_notices', 'results'), ('news', 'news'),
      ('academic_calendar', 'calendar'), ('announcement_banners', 'notifications'),
      ('guides', 'guides'), ('teacher_granted_tabs', 'staff'), ('teacher_hidden_tabs', 'staff'),
      ('feedback', 'feedback')) as x(t, perm)
  loop
    continue when to_regclass('public.' || m.t) is null;
    for p in select * from pg_policies
              where schemaname = 'public' and tablename = m.t and cmd <> 'SELECT'
                and coalesce(qual, '') || coalesce(with_check, '') ~* broad
                and coalesce(qual, '') || coalesce(with_check, '') !~* 'has_permission|has_admin_role|admin_roles'
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
    execute format('create policy %I on public.%I for all to authenticated using (public.has_permission(%L)) with check (public.has_permission(%L))',
                   m.t || '_perm_write', m.t, m.perm, m.perm);
  end loop;
end $do$;

-- التحقق: سياسات الكتابة في الجداول التسعة بعد التعديل
select tablename as "الجدول", policyname as "السياسة", cmd as "العملية",
       left(coalesce(with_check, qual), 70) as "الشرط"
  from pg_policies
 where schemaname = 'public' and cmd <> 'SELECT'
   and tablename in ('student_results', 'period_notices', 'news', 'academic_calendar', 'announcement_banners',
                     'guides', 'teacher_granted_tabs', 'teacher_hidden_tabs', 'feedback')
 order by 1, 2;
-- نهاية الجزء 1
