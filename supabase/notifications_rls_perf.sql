-- =====================================================================
-- تسريع قواعد الصلاحية (RLS) لجداول الإشعارات والمستخدمين
--
-- السبب: القواعد تستدعي auth.uid() وis_admin() مباشرة، فتُنفَّذ مرة لكل صف
-- يمرّ على الاستعلام. استعلام عدّ الإشعارات أو المستخدمين (وهو ما تفعله
-- صفحة «مؤشرات الموقع») كان يستغرق 2.5–4 ثوانٍ لهذا السبب.
--
-- الحل: تغليف الاستدعاء بـ (select ...) فيُحسب مرة واحدة للاستعلام كله
-- (initplan). الصلاحيات نفسها لا تتغيّر: من يرى ومن يعدّل كما كان تمامًا.
--   • القاعدة الإدارية: is_admin(uid) = دور admin وحساب مفعّل، وهو عين الفحص
--     الذي كان مكتوبًا داخل القاعدة (EXISTS على users).
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- =====================================================================

-- ---------- notification_recipients ----------
drop policy if exists notif_rec_read on public.notification_recipients;
create policy notif_rec_read on public.notification_recipients as permissive for select to public
  using (
    user_id = (select auth.uid())
    or (select public.is_admin((select auth.uid())))
  );

drop policy if exists notif_rec_update on public.notification_recipients;
create policy notif_rec_update on public.notification_recipients as permissive for update to public
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------- notifications ----------
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

-- ---------- users ----------
drop policy if exists users_read_own on public.users;
create policy users_read_own on public.users as permissive for select to public
  using (id = (select auth.uid()));

drop policy if exists users_admin_read on public.users;
create policy users_admin_read on public.users as permissive for select to authenticated
  using ((select public.is_admin()));

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users as permissive for update to public
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
