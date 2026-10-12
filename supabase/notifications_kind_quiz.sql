-- =====================================================================
-- إشعار الاختبار الإلكتروني: publish_online_quiz ترسل إشعارًا بنوع 'quiz'،
-- وقيد notifications_kind_check لم يكن يقبله، فيفشل «نشر وإرسال» بخطأ:
--   new row for relation "notifications" violates check constraint "notifications_kind_check"
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array['general', 'absence', 'permission', 'news', 'alert', 'quiz']));

-- نهاية الملف
