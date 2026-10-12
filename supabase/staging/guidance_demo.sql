-- =====================================================================
--  أعمال تجريبية لموجه الصف الأول (9000000021) — للنسخة التجريبية فقط.
--  تملأ التقرير الشهري للتوجيه الطلابي: حالات وجلسات وبرامج وطلبات مقابلة
--  واستمارات مستوى وإحالات ونماذج، لطلاب فصل 101.
--  التواريخ نسبية: كل تشغيل للإعداد يعيدها إلى الشهر الحالي (حتى اليوم).
--  يُشغَّل بعد seed.sql. قابل لإعادة التشغيل بمعرّفات ثابتة.
-- =====================================================================

-- يوم من الشهر الحالي لا يتجاوز اليوم
create or replace function pg_temp.d(k int) returns date language sql as
$$ select least(date_trunc('month', current_date)::date + k, current_date) $$;

-- الحالات: اثنتان مفتوحتان واثنتان أُغلقتا هذا الشهر، وحالة من الشهر الماضي
insert into public.guidance_cases (id, student_id, grade, source, title, details, status, outcome, close_note,
                                   academic_year, term, opened_by, opened_by_name, opened_at, closed_at)
values
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-e000-000000000102', 1, 'warning', 'غياب متكرر', '• غياب 6 أيام', 'open', null, null,
   '1448', 1, '00000000-0000-4000-a000-000000000021', 'الموجه الطلابي للصف الأول (تجريبي)', pg_temp.d(1), null),
  ('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-e000-000000000103', 1, 'teacher', 'تعثر دراسي في الرياضيات', null, 'open', null, null,
   '1448', 1, '00000000-0000-4000-a000-000000000021', 'الموجه الطلابي للصف الأول (تجريبي)', pg_temp.d(3), null),
  ('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-e000-000000000104', 1, 'guardian', 'صعوبة في التكيف مع المدرسة', null, 'closed', 'improved', 'تحسّن واضح بعد الجلسات',
   '1448', 1, '00000000-0000-4000-a000-000000000021', 'الموجه الطلابي للصف الأول (تجريبي)', pg_temp.d(0), pg_temp.d(9)),
  ('00000000-0000-4000-9000-000000000004', '00000000-0000-4000-e000-000000000101', 1, 'referral', 'ملاحظات سلوكية', null, 'closed', 'continuing', null,
   '1448', 1, '00000000-0000-4000-a000-000000000021', 'الموجه الطلابي للصف الأول (تجريبي)', pg_temp.d(2), pg_temp.d(10)),
  ('00000000-0000-4000-9000-000000000005', '00000000-0000-4000-e000-000000000101', 1, 'student', 'قلق الاختبارات', null, 'closed', 'improved', null,
   '1448', 1, '00000000-0000-4000-a000-000000000021', 'الموجه الطلابي للصف الأول (تجريبي)', pg_temp.d(-25), pg_temp.d(-12))
on conflict (id) do update set opened_at = excluded.opened_at, closed_at = excluded.closed_at, status = excluded.status, outcome = excluded.outcome;

-- الجلسات: هذا الشهر بأنواعها، وجلستان في الشهر الماضي لرسم الاتجاه
insert into public.guidance_sessions (id, case_id, session_date, kind, summary, recommendation, created_by, created_by_name)
select ('00000000-0000-4000-9100-0000000000' || lpad(v.n::text, 2, '0'))::uuid, ('00000000-0000-4000-9000-00000000000' || v.c)::uuid,
       pg_temp.d(v.k), v.kind, v.summary, null, '00000000-0000-4000-a000-000000000021', 'الموجه الطلابي للصف الأول (تجريبي)'
from (values
  (1, 1, 1, 'individual', 'جلسة تعارف وحصر أسباب الغياب'), (2, 1, 5, 'guardian', 'مقابلة ولي الأمر والاتفاق على المتابعة'),
  (3, 1, 9, 'individual', 'متابعة الحضور بعد الاتفاق'), (4, 2, 3, 'individual', 'تحديد صعوبات مادة الرياضيات'),
  (5, 2, 6, 'teacher', 'التنسيق مع معلم الرياضيات لخطة علاجية'), (6, 3, 2, 'individual', 'جلسة دعم نفسي وتكيّف'),
  (7, 3, 7, 'group', 'جلسة جماعية لمهارات التواصل'), (8, 4, 4, 'individual', 'مناقشة السلوك والاتفاق على بدائل'),
  (9, 4, 8, 'guardian', 'إشعار ولي الأمر بالخطة السلوكية'), (10, 2, 10, 'group', 'جلسة جماعية لمهارات المذاكرة'),
  (11, 5, -24, 'individual', 'مهارات إدارة القلق'), (12, 5, -15, 'individual', 'تقييم أثر الجلسات')
) as v(n, c, k, kind, summary)
on conflict (id) do update set session_date = excluded.session_date;

-- البرامج: برنامجان نُفّذا هذا الشهر، وبرنامج مخطط للشهر القادم
insert into public.guidance_programs (id, grade, title, kind, target, planned_date, status, done_date, beneficiaries, outcome,
                                      academic_year, term, created_by, created_by_name)
values
  ('00000000-0000-4000-9200-000000000001', 1, 'الأسبوع التمهيدي للطلاب المستجدين', 'developmental', 'طلاب الصف الأول', pg_temp.d(1), 'done', pg_temp.d(1), 4,
   'تعرّف الطلاب على المدرسة وأنظمتها، وتفاعلوا مع الأنشطة التعريفية.', '1448', 1, '00000000-0000-4000-a000-000000000021', 'الموجه الطلابي للصف الأول (تجريبي)'),
  ('00000000-0000-4000-9200-000000000002', 1, 'مهارات المذاكرة وتنظيم الوقت', 'preventive', 'طلاب فصل 101', pg_temp.d(8), 'done', pg_temp.d(8), 4,
   'ورشة عملية بجدول أسبوعي للمذاكرة، وتقييم قبلي وبعدي أظهر تحسنًا.', '1448', 1, '00000000-0000-4000-a000-000000000021', 'الموجه الطلابي للصف الأول (تجريبي)'),
  ('00000000-0000-4000-9200-000000000003', 1, 'الوقاية من التنمر', 'awareness', 'طلاب الصف الأول',
   (date_trunc('month', current_date) + interval '1 month 5 days')::date, 'planned', null, null, null,
   '1448', 1, '00000000-0000-4000-a000-000000000021', 'الموجه الطلابي للصف الأول (تجريبي)')
on conflict (id) do update set planned_date = excluded.planned_date, done_date = excluded.done_date;

-- استمارتا مستوى: واحدة أُرسلت لولي الأمر، وأخرى عند المعلمين
insert into public.guidance_inquiries (id, student_id, student_name, class_label, grade, flag, status,
                                       counselor_id, counselor_name, academic_year, term, created_at, sent_at)
values
  ('00000000-0000-4000-9300-000000000001', '00000000-0000-4000-e000-000000000103', 'طالب تجريبي الثالث', '101', 1, 'urgent', 'sent',
   '00000000-0000-4000-a000-000000000021', 'الموجه الطلابي للصف الأول (تجريبي)', '1448', 1, pg_temp.d(3), pg_temp.d(7)),
  ('00000000-0000-4000-9300-000000000002', '00000000-0000-4000-e000-000000000102', 'طالب تجريبي الثاني', '101', 1, null, 'teachers',
   '00000000-0000-4000-a000-000000000021', 'الموجه الطلابي للصف الأول (تجريبي)', '1448', 1, pg_temp.d(9), null)
on conflict (id) do update set created_at = excluded.created_at, sent_at = excluded.sent_at;

-- إحالتان وصلتا الموجه: واحدة عالجها، وأخرى لديه الآن
insert into public.student_referrals (id, serial, student_id, student_name, class_label, grade, teacher_name, subject,
                                      referral_date, reason, status, counselor_id, counselor_name, counselor_at, created_at)
values
  ('00000000-0000-4000-9400-000000000001', 'T-DEMO-1', '00000000-0000-4000-e000-000000000101', 'طالب تجريبي الأول', '101', 1,
   'معلم الرياضيات (تجريبي)', 'الرياضيات', pg_temp.d(2), 'كثرة الحديث أثناء الشرح', 'closed',
   '00000000-0000-4000-a000-000000000021', 'الموجه الطلابي للصف الأول (تجريبي)', pg_temp.d(4), pg_temp.d(2)),
  ('00000000-0000-4000-9400-000000000002', 'T-DEMO-2', '00000000-0000-4000-e000-000000000104', 'طالب تجريبي الرابع', '101', 1,
   'معلم اللغة العربية (تجريبي)', 'اللغة العربية', pg_temp.d(9), 'عدم إحضار الكتاب والواجبات', 'with_counselor',
   null, null, null, pg_temp.d(9))
on conflict (id) do update set referral_date = excluded.referral_date, counselor_at = excluded.counselor_at, created_at = excluded.created_at;

-- نماذج التوجيه التي أصدرها الموجه (ما وُجد قالبه)
insert into public.form_documents (id, template_id, serial, title, recipient, student_id, data, status, hijri_year, created_by, created_at)
select ('00000000-0000-4000-9500-00000000000' || v.n)::uuid, t.id, 'G-DEMO-' || v.n, t.title, v.who, v.sid::uuid,
       '{}'::jsonb, 'issued', 1448, '00000000-0000-4000-a000-000000000021', pg_temp.d(v.k)::timestamptz + interval '9 hours'
from (values
  (1, 'guidance_guardian_call', 'طالب تجريبي الثاني', '00000000-0000-4000-e000-000000000102', 4),
  (2, 'guidance_guardian_meeting', 'طالب تجريبي الثاني', '00000000-0000-4000-e000-000000000102', 5),
  (3, 'guidance_session', 'طالب تجريبي الرابع', '00000000-0000-4000-e000-000000000104', 7),
  (4, 'guidance_pledge', 'طالب تجريبي الأول', '00000000-0000-4000-e000-000000000101', 8),
  (5, 'guidance_guardian_call', 'طالب تجريبي الأول', '00000000-0000-4000-e000-000000000101', 10)
) as v(n, tkey, who, sid, k)
join public.form_templates t on t.key = v.tkey
on conflict (id) do update set created_at = excluded.created_at;

-- طلبا مقابلة: يُرسلان باسم الطالب وولي الأمر كما في البوابة (مشغّل الطلب يتحقق من صاحبه)
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000101","role":"authenticated"}';
insert into public.guidance_requests (id, student_id, requester, reason, preferred)
select '00000000-0000-4000-9600-000000000001', '00000000-0000-4000-e000-000000000101', 'student', 'أحتاج مساعدة في تنظيم وقت المذاكرة', 'الفسحة'
where not exists (select 1 from public.guidance_requests where id = '00000000-0000-4000-9600-000000000001');
commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000201","role":"authenticated"}';
insert into public.guidance_requests (id, student_id, requester, reason, preferred)
select '00000000-0000-4000-9600-000000000002', '00000000-0000-4000-e000-000000000101', 'guardian', 'متابعة مستوى ابني الدراسي', 'أي وقت'
where not exists (select 1 from public.guidance_requests where id = '00000000-0000-4000-9600-000000000002');
commit;

-- الأول تمّ، وكلاهما في الشهر الحالي
update public.guidance_requests set status = 'done', created_at = pg_temp.d(5)::timestamptz + interval '8 hours'
 where id = '00000000-0000-4000-9600-000000000001';
update public.guidance_requests set created_at = pg_temp.d(9)::timestamptz + interval '8 hours'
 where id = '00000000-0000-4000-9600-000000000002';
