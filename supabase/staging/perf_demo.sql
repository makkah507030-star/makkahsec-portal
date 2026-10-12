-- =====================================================================
--  شواهد تجريبية لقسم الرياضيات — للنسخة التجريبية فقط.
--  تملأ «ملف التطوير المهني للقسم» لرئيسه (معلم الرياضيات 9000000011)
--  و«شواهد الأداء الوظيفي» له ولزميله معلم الفيزياء (9000000014)،
--  وجلسة مجتمع تعلم معتمدة للقسم. يُشغَّل بعد seed.sql، وإعادته آمنة.
-- =====================================================================

-- شواهد ملف الأداء: (معرّف ثابت، المعلم، البند، العنوان، الجهة، قبل كم يوم، الساعات، العداد)
insert into public.perf_evidence (id, teacher_user_id, academic_year, item_key, source, title, provider, event_date, hours, use_count)
select ('00000000-0000-4000-9700-0000000000' || lpad(v.n::text, 2, '0'))::uuid, v.uid::uuid, '1448', v.item, 'upload', v.title,
       v.provider, case when v.ago is null then null else current_date - v.ago end, v.hours, v.cnt
from (values
  (1, '00000000-0000-4000-a000-000000000011', 'e02_02', 'برنامج استراتيجيات التعلم النشط', 'منصة أبعاد', 30, 10, 1),
  (2, '00000000-0000-4000-a000-000000000011', 'e02_02', 'برنامج الإسعافات الأولية', 'الهلال الأحمر', 12, 4, 1),
  (3, '00000000-0000-4000-a000-000000000011', 'e02_01', 'تنفيذ برنامج: توظيف الآلة الحاسبة البيانية', 'المدرسة', 20, 3, 1),
  (4, '00000000-0000-4000-a000-000000000011', 'e02_09', 'الرخصة المهنية', null, null, null, 1),
  (5, '00000000-0000-4000-a000-000000000011', 'e02_11', 'تأمل ذاتي في تدريس حل المسائل', null, 8, null, 1),
  (6, '00000000-0000-4000-a000-000000000011', 'e03_03', 'كشف حضور اجتماع أولياء الأمور', null, null, null, 2),
  (7, '00000000-0000-4000-a000-000000000011', 'e04_02', 'تحضير درس بالتعلم التعاوني', null, null, null, 3),
  (8, '00000000-0000-4000-a000-000000000011', 'e05_01', 'أهداف الدرس ومعايير النجاح', null, null, null, 4),
  (9, '00000000-0000-4000-a000-000000000011', 'e06_01', 'توزيع منهج الرياضيات', null, null, null, 1),
  (10, '00000000-0000-4000-a000-000000000011', 'e06_02', 'خطة التعلم الأسبوعية', null, null, null, 5),
  (11, '00000000-0000-4000-a000-000000000011', 'e07_02', 'برنامج جيوجبرا في درس الدوال', null, null, null, 2),
  (12, '00000000-0000-4000-a000-000000000011', 'e08_01', 'صور تنظيم الفصل وقواعد السلامة', null, null, null, 1),
  (13, '00000000-0000-4000-a000-000000000011', 'e09_01', 'القوانين الصفية معروضة في الفصل', null, null, null, 1),
  (14, '00000000-0000-4000-a000-000000000011', 'e10_04', 'أهداف قصيرة وطويلة المدى للطلاب', null, null, null, 1),
  (15, '00000000-0000-4000-a000-000000000014', 'e02_02', 'برنامج التقويم البنائي', 'مركز التدريب', 25, 6, 1),
  (16, '00000000-0000-4000-a000-000000000014', 'e02_05', 'مؤتمر تعليم العلوم والرياضيات', 'جامعة أم القرى', 15, null, 1),
  (17, '00000000-0000-4000-a000-000000000014', 'e02_04', 'حضور زيارة تبادلية لمعلم الرياضيات', 'المدرسة', 6, null, 1),
  (18, '00000000-0000-4000-a000-000000000014', 'e06_02', 'خطة التعلم الأسبوعية', null, null, null, 3)
) as v(n, uid, item, title, provider, ago, hours, cnt)
where exists (select 1 from public.perf_items i where i.key = v.item and i.is_active)
on conflict do nothing;

-- جلسة مجتمع تعلم معتمدة لقسم الرياضيات
insert into public.plc_sessions (id, department_id, head_user_id, head_name, academic_year, data, status, decided_at)
select '00000000-0000-4000-9800-000000000001', d.id, '00000000-0000-4000-a000-000000000011', 'معلم الرياضيات (تجريبي)', '1448',
       jsonb_build_object('topic', 'تحليل نتائج اختبار الفترة الأولى وبناء الخطط العلاجية', 'date', (current_date - 10)::text),
       'approved', now() - interval '9 days'
  from public.departments d where d.name = 'الرياضيات'
on conflict (id) do nothing;

-- اختبارات معلم الرياضيات المصحّحة: «تحليل النتائج» والتقرير الشهري للمدرسة
insert into public.quizzes (id, teacher_id, title, subject_id, subject_name, grade, period, total_marks, exam_date, academic_year, term, status, mode)
values
  ('00000000-0000-4000-9b00-000000000001', '00000000-0000-4000-a000-000000000011', 'اختبار قصير: الدوال', '00000000-0000-4000-c000-000000000101', 'الرياضيات', 1, 'period1', 20,
   least(date_trunc('month', current_date)::date + 3, current_date), '1448', 1, 'closed', 'omr'),
  ('00000000-0000-4000-9b00-000000000002', '00000000-0000-4000-a000-000000000011', 'اختبار إلكتروني: المتتابعات', '00000000-0000-4000-c000-000000000101', 'الرياضيات', 1, 'period1', 10,
   least(date_trunc('month', current_date)::date + 8, current_date), '1448', 1, 'closed', 'online'),
  ('00000000-0000-4000-9b00-000000000003', '00000000-0000-4000-a000-000000000011', 'اختبار الفترة الأولى', '00000000-0000-4000-c000-000000000102', 'الرياضيات', 2, 'period1', 30,
   least(date_trunc('month', current_date)::date + 6, current_date), '1448', 1, 'marking', 'paper')
on conflict (id) do update set exam_date = excluded.exam_date;

insert into public.quiz_classes (quiz_id, class_id)
values ('00000000-0000-4000-9b00-000000000001', '00000000-0000-4000-d000-000000000101'),
       ('00000000-0000-4000-9b00-000000000002', '00000000-0000-4000-d000-000000000101'),
       ('00000000-0000-4000-9b00-000000000003', '00000000-0000-4000-d000-000000000201')
on conflict (quiz_id, class_id) do nothing;

-- درجات الطلاب: نسب ثابتة متنوعة من الدرجة الكلية، وغياب طالب في اختبار
insert into public.quiz_submissions (quiz_id, class_id, student_id, score, absent)
select q.id, qc.class_id, e.student_id,
       case when q.id::text like '%2' and right(e.student_id::text, 1) = '4' then null
            else round(q.total_marks * (array[0.95, 0.82, 0.68, 0.55])[(right(e.student_id::text, 1)::int - 1) % 4 + 1], 1) end,
       q.id::text like '%2' and right(e.student_id::text, 1) = '4'
  from public.quizzes q
  join public.quiz_classes qc on qc.quiz_id = q.id
  join public.student_enrollment e on e.class_id = qc.class_id and e.academic_year = '1448'
 where q.id::text like '00000000-0000-4000-9b00-%'
on conflict (quiz_id, student_id) do nothing;
