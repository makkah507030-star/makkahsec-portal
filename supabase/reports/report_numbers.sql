-- أرقام تقرير البوابة للجنة التقويم — قراءة فقط، لا يغيّر شيئًا
-- يُشغَّل في Supabase ← SQL Editor ← Run، وتُرسل النتيجة كاملة (البند، القيمة)
-- الجدول غير الموجود يظهر رقمه «—» بدل أن يُفشل الاستعلام
create or replace function pg_temp.n(q text, t text) returns text language plpgsql as $$
declare v bigint;
begin
  if to_regclass('public.' || t) is null then return '—'; end if;
  execute q into v;
  return coalesce(v, 0)::text;
end $$;

with r(o, item, val) as (values
  (1,  'أول تحضير مسجّل', (select min(attend_date)::text from public.class_attendance)),
  (2,  'سجلات الحضور (طالب × حصة)', pg_temp.n('select count(*) from public.class_attendance', 'class_attendance')),
  (3,  'حصص حُضّرت', pg_temp.n('select count(distinct (schedule_id, attend_date)) from public.class_attendance', 'class_attendance')),
  (4,  'إشعارات أُرسلت', pg_temp.n('select count(*) from public.notifications', 'notifications')),
  (5,  'إشعارات وصلت للحسابات', pg_temp.n('select count(*) from public.notification_recipients', 'notification_recipients')),
  (6,  'أجهزة فعّلت إشعارات الجوال', pg_temp.n('select count(*) from public.push_subscriptions', 'push_subscriptions')),
  (7,  'خانات رصد في سجل المتابعة', pg_temp.n('select count(*) from public.teacher_follow_up where mark is not null', 'teacher_follow_up')),
  (8,  'حسابات مفعّلة', pg_temp.n('select count(*) from public.users where not must_change_pw', 'users')),
  (9,  'منها حسابات معلمين', pg_temp.n('select count(*) from public.users u join public.teachers t on t.user_id = u.id where not u.must_change_pw', 'teachers')),
  (10, 'منها حسابات طلاب', pg_temp.n('select count(*) from public.users where not must_change_pw and role = ''student''', 'users')),
  (11, 'منها حسابات أولياء أمور', pg_temp.n('select count(*) from public.users where not must_change_pw and role = ''guardian''', 'users')),
  (12, 'نماذج رسمية صدرت', pg_temp.n('select count(*) from public.form_documents', 'form_documents')),
  (13, 'منها معتمدة', pg_temp.n('select count(*) from public.form_documents where approved_at is not null', 'form_documents')),
  (14, 'أيام غياب رسمي اعتُمدت', pg_temp.n('select count(*) from public.official_attendance_days where approved_at is not null', 'official_attendance_days')),
  (15, 'بصمات حضور وصلت من الأجهزة', pg_temp.n('select count(*) from public.daily_attendance', 'daily_attendance')),
  (16, 'إحالات طلاب', pg_temp.n('select count(*) from public.student_referrals', 'student_referrals')),
  (17, 'منها مغلقة', pg_temp.n('select count(*) from public.student_referrals where closed_at is not null', 'student_referrals')),
  (18, 'أحداث ومناسبات', pg_temp.n('select count(*) from public.school_events where cancelled_at is null', 'school_events')),
  (19, 'منها معتمدة', pg_temp.n('select count(*) from public.school_events where cancelled_at is null and approved_at is not null', 'school_events')),
  (20, 'طلاب شاركوا في الأحداث', pg_temp.n('select count(distinct student_id) from public.event_participants', 'event_participants')),
  (21, 'موافقات أولياء أمور إلكترونية', pg_temp.n('select count(*) from public.event_participants where consent_at is not null', 'event_participants')),
  (22, 'شهادات مشاركة صدرت', pg_temp.n('select count(*) from public.event_participants where cert_issued_at is not null', 'event_participants')),
  (23, 'اختبارات أنشأها المعلمون', pg_temp.n('select count(*) from public.quizzes', 'quizzes')),
  (24, 'منها إلكترونية', pg_temp.n('select count(*) from public.quiz_online', 'quiz_online')),
  (25, 'أوراق اختبار رُصدت', pg_temp.n('select count(*) from public.quiz_submissions where marked_at is not null', 'quiz_submissions')),
  (26, 'خطط علاجية وإثرائية', pg_temp.n('select count(*) from public.quiz_plans', 'quiz_plans')),
  (27, 'جلسات مجتمع التعلم المهني', pg_temp.n('select count(*) from public.plc_sessions', 'plc_sessions')),
  (28, 'نماذج سجل التطوير المهني', pg_temp.n('select count(*) from public.pd_reports', 'pd_reports')),
  (29, 'تبادل زيارات بين المعلمين', pg_temp.n('select count(*) from public.exchange_visits', 'exchange_visits')),
  (30, 'شواهد أداء رفعها المعلمون', pg_temp.n('select count(*) from public.perf_evidence', 'perf_evidence')),
  (31, 'ملفات معلمين رقمية مفعّلة', pg_temp.n('select count(*) from public.teacher_dfiles', 'teacher_dfiles')),
  (32, 'زيارات للملفات الرقمية', pg_temp.n('select count(*) from public.dfile_visits', 'dfile_visits')),
  (33, 'توصيات في خطط التطوير', pg_temp.n('select count(*) from public.improvement_goals', 'improvement_goals')),
  (34, 'حالات التوجيه الطلابي', pg_temp.n('select count(*) from public.guidance_cases', 'guidance_cases')),
  (35, 'جلسات إرشادية', pg_temp.n('select count(*) from public.guidance_sessions', 'guidance_sessions')),
  (36, 'استمارات توضيح مستوى', pg_temp.n('select count(*) from public.guidance_inquiries', 'guidance_inquiries')),
  (37, 'ملاحظات الطلاب (صحية وغيرها)', pg_temp.n('select count(*) from public.student_notes', 'student_notes')),
  (38, 'بلاغات الطلاب المنقطعين', pg_temp.n('select count(*) from public.student_dropouts', 'student_dropouts')),
  (39, 'ملاحظات ومهام «مفكرتي»', pg_temp.n('select count(*) from public.staff_notes', 'staff_notes')),
  (40, 'تصاميم الاستوديو المحفوظة', pg_temp.n('select count(*) from public.studio_designs', 'studio_designs')),
  (41, 'طباعة وتنزيل من الاستوديو والنماذج', pg_temp.n('select count(*) from public.usage_events', 'usage_events')),
  (42, 'طلبات الدعم والملاحظات', pg_temp.n('select count(*) from public.feedback', 'feedback')),
  (43, 'إقرارات ميثاق أخلاقيات المهنة', pg_temp.n('select count(*) from public.doc_acks', 'doc_acks')),
  (44, 'سياسات الحماية RLS', (select count(*)::text from pg_policies where schemaname = 'public')),
  (45, 'جداول قاعدة البيانات', (select count(*)::text from pg_tables where schemaname = 'public'))
)
select item as "البند", val as "القيمة" from r order by o;
-- نهاية الاستعلام
