-- =====================================================================
-- تسريع قاعدة قراءة notifications (الخطوة الثانية بعد notifications_rls_perf.sql)
--
-- السبب (من EXPLAIN ANALYZE): قاعدة notif_read كانت تبحث لكل إشعار على حدة
-- هل للمستخدم صف في notification_recipients (EXISTS مرتبطة بالصف)، فتُنفَّذ
-- ١١٤ مرة لمستخدم لديه ١١٤ إشعارًا — نحو ٢٢٠ms من أصل ٢٢٢ms.
--
-- الحل: استعلام غير مرتبط (IN) يحسب قائمة إشعارات المستخدم مرة واحدة
-- ويخزنها في جدول تجزئة، ثم يفحص كل إشعار فيها. الصلاحيات نفسها لا تتغيّر:
-- يرى المستخدم إشعاراته، ويرى الإداري المفعّل الكل.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- =====================================================================

drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications as permissive for select to public
  using (
    (select public.is_admin((select auth.uid())))
    or id in (
      select r.notification_id
      from public.notification_recipients r
      where r.user_id = (select auth.uid())
    )
  );
