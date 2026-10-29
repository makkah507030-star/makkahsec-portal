-- =====================================================================
-- فحص للقراءة فقط: حساب «برنامج الموهوبين» — لمن أُسند الدور، وهل حسابه نشط ومعلّم،
-- وهل لدوره صلاحية «برنامج الموهوبين» (gifted) التي تفتح الصفحة والاستوديو،
-- ومن غيره يملك الصلاحية نفسها. لا يغيّر شيئًا. يُنفَّذ في Supabase ← SQL Editor.
-- =====================================================================
select 'صاحب الدور' as "البند",
       coalesce(nullif(trim(t.full_name), ''), u.full_name) || ' · ' || u.username
         || case when u.is_active then ' · نشط' else ' · موقوف' end
         || ' · معلم: ' || case when t.user_id is not null then 'نعم' else 'لا' end as "النتيجة"
  from public.admin_roles ar join public.users u on u.id = ar.user_id
  left join public.teachers t on t.user_id = u.id
 where ar.role_type = 'gifted_program'
union all
select 'صاحب الدور', 'لا أحد — الدور غير مُسنَد'
 where not exists (select 1 from public.admin_roles where role_type = 'gifted_program')
union all
select 'صلاحيات الدور', coalesce((select string_agg(permission, '، ' order by permission)
                                    from public.role_permissions where role_type = 'gifted_program'), 'لا شيء')
union all
select 'صلاحية «برنامج الموهوبين» للدور',
       case when exists (select 1 from public.role_permissions where role_type = 'gifted_program' and permission = 'gifted')
            then 'نعم' else 'لا — شغّل gifted_1.sql' end
union all
select 'أدوار أخرى لها الصلاحية', coalesce((select string_agg(role_type::text, '، ')
                                              from public.role_permissions where permission = 'gifted' and role_type <> 'gifted_program'), 'لا شيء')
union all
select 'جداول البرنامج',
       case when to_regclass('public.mawhiba_tracking') is null then 'gifted_1 لم يُشغَّل' else 'المتابعة ✓' end || ' · ' ||
       case when to_regclass('public.gifted_members') is null then 'gifted_2 لم يُشغَّل' else 'الموهوبون ✓' end || ' · ' ||
       case when to_regclass('public.gifted_programs') is null then 'gifted_3 لم يُشغَّل' else 'الخطة ✓' end;
-- نهاية الجزء 1
