-- =====================================================================
-- إصلاح بطء جلب الإشعارات (الخطوة الثالثة)
--
-- ما كشفته خطط EXPLAIN ANALYZE:
--   ١) استعلام IN غير المرتبط (notifications_read_policy_hash.sql) جعل المخطط
--      يمسح كل جدول notifications (١٧٤٠٥ صفًا): ٦٨٢ms بدل ٢٢٢ms. يُتراجع عنه هنا.
--   ٢) قاعدة users_admin_write (ALL) تستدعي has_admin_role() لكل صف من users،
--      وكل قاعدة تفحص «هل هذا إداري؟» تمرّ بها (١٧٥٩ صفًا = ٦٨ms).
--
-- الحل:
--   • دالة my_notifications(): تجلب إشعارات المستخدم الحالي مباشرة
--     (security definer، مقيّدة بـ auth.uid())، دون مرور كل صف بقواعد RLS.
--     الصلاحيات نفسها: لا يرى المستخدم إلا إشعاراته.
--   • إعادة notif_read إلى صيغتها السابقة الأسرع.
--   • تغليف has_admin_role في users_admin_write بـ (select ...).
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- =====================================================================

-- ١) التراجع عن قاعدة IN إلى EXISTS (صيغة notifications_rls_perf.sql)
drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications as permissive for select to public
  using (
    (select public.is_admin((select auth.uid())))
    or exists (
      select 1 from public.notification_recipients r
      where r.notification_id = notifications.id
        and r.user_id = (select auth.uid())
    )
  );

-- ٢) users_admin_write: has_admin_role تُحسب مرة واحدة لا لكل صف
drop policy if exists users_admin_write on public.users;
create policy users_admin_write on public.users as permissive for all to authenticated
  using ((select public.has_admin_role('principal'::admin_role_type)))
  with check ((select public.has_admin_role('principal'::admin_role_type)));

-- ٣) إشعارات المستخدم الحالي — الأحدث أولًا
create or replace function public.my_notifications(p_limit int default 50)
returns table (
  id uuid, title text, body text, kind text, link text,
  created_at timestamptz, read_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select n.id, n.title, n.body, n.kind::text, n.link, n.created_at, r.read_at
  from public.notification_recipients r
  join public.notifications n on n.id = r.notification_id
  where r.user_id = (select auth.uid())
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.my_notifications(int) from public, anon;
grant execute on function public.my_notifications(int) to authenticated;
