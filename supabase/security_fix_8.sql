-- =====================================================================
-- الاستئذان وملاحظات الغياب: الكتابة لمن يعمل بها فعلًا — المرحلة 3، الجزء 1 من 1.
-- كان أي حساب إداري (حتى المختبر والإعلام) يرفع استئذانًا أو يسجّل عودة أو يحذفهما.
-- صار يكتب فيها:
--   ١) من يملك صلاحية «الاستئذان» (والمدير والدعم الفني دائمًا)؛
--   ٢) أصحاب الأدوار الأساسية (وكلاء، موجهون، مساعدون…) الذين تظهر لهم لوحة الغائبين؛
--   ٣) القائد الكشفي وحده في كل الأيام (لا نائبه ولا بقية أدوار الكشافة)؛
--   ٤) منظّم حدث في يوم حدثه (خطوة الاستئذان والعودة في الأحداث، مثل برنامج جلوب).
-- الحسابات المساندة (مختبر، إعلام، رياضة…) لا تكتب إلا في يوم حدث تنظّمه، والمعلم لا يكتب.
-- مخوّلو الاستئذان (permission_grantors): يعدّلهم من يملك صلاحية «الاستئذان».
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.can_write_permission(p_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() and (
    public.has_permission('permissions')
    -- دور أساسي (غير الحسابات المساندة في لوحة التحكم)
    or exists (select 1 from public.admin_roles ar left join public.custom_roles c on c.role_type = ar.role_type
                where ar.user_id = auth.uid()
                  and ar.role_type::text <> all (array['activity_leader', 'media_portal', 'gifted_program',
                      'globe_program', 'student_voice', 'makkah_sport', 'safety_security', 'health_counselor',
                      'science_labs', 'computer_lab'])
                  and coalesce(c.label, '') not like '%كشف%')   -- أدوار الكشافة: القائد وحده أدناه
    -- القائد الكشفي (كما في scout_leader: لا نائبه)
    or exists (select 1 from public.admin_roles ar join public.custom_roles c on c.role_type = ar.role_type
                where ar.user_id = auth.uid() and c.label like '%القائد الكشفي%' and c.label not like '%نائب%')
    -- منظّم حدث في يومه
    or (p_date is not null and exists (select 1 from public.school_events e
                                        where e.organizer_id = auth.uid() and e.event_date = p_date)));
$$;
revoke execute on function public.can_write_permission(date) from public, anon;
grant execute on function public.can_write_permission(date) to authenticated, service_role;

-- حذف سياسات الكتابة العامة القديمة (تُقرأ من القاعدة نفسها، والقراءة لا تتغير)
do $do$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
            where schemaname = 'public' and cmd <> 'SELECT'
              and tablename in ('permission_requests', 'permission_request_students', 'permission_returns',
                                'admin_missing_notes', 'permission_grantors')
              and policyname not like '%\_pw\_%'
              -- الشرط العام «حساب admin» فقط (لا تُمسّ سياسات أخرى إن وُجدت)
              and coalesce(qual, '') || coalesce(with_check, '') ~* 'is_admin\(|''admin''::'
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $do$;

drop policy if exists pr_pw_ins on public.permission_requests;
drop policy if exists pr_pw_upd on public.permission_requests;
drop policy if exists pr_pw_del on public.permission_requests;
create policy pr_pw_ins on public.permission_requests for insert to authenticated
  with check (created_by = auth.uid() and public.can_write_permission(request_date));
create policy pr_pw_upd on public.permission_requests for update to authenticated
  using (public.can_write_permission(request_date)) with check (public.can_write_permission(request_date));
create policy pr_pw_del on public.permission_requests for delete to authenticated
  using (public.can_write_permission(request_date));

drop policy if exists prs_pw_all on public.permission_request_students;
create policy prs_pw_all on public.permission_request_students for all to authenticated
  using (exists (select 1 from public.permission_requests r
                  where r.id = request_id and public.can_write_permission(r.request_date)))
  with check (exists (select 1 from public.permission_requests r
                       where r.id = request_id and public.can_write_permission(r.request_date)));

drop policy if exists preturns_pw_all on public.permission_returns;
create policy preturns_pw_all on public.permission_returns for all to authenticated
  using (public.can_write_permission(return_date)) with check (public.can_write_permission(return_date));

drop policy if exists amn_pw_all on public.admin_missing_notes;
create policy amn_pw_all on public.admin_missing_notes for all to authenticated
  using (public.can_write_permission(null)) with check (public.can_write_permission(null));

drop policy if exists grantors_pw_all on public.permission_grantors;
create policy grantors_pw_all on public.permission_grantors for all to authenticated
  using (public.has_permission('permissions')) with check (public.has_permission('permissions'));

-- التحقق: سياسات الكتابة في الجداول الخمسة بعد التعديل
select tablename as "الجدول", policyname as "السياسة", cmd as "العملية"
  from pg_policies
 where schemaname = 'public' and cmd <> 'SELECT'
   and tablename in ('permission_requests', 'permission_request_students', 'permission_returns',
                     'admin_missing_notes', 'permission_grantors')
 order by 1, 2;
-- نهاية الجزء 1
