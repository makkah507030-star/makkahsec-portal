-- =====================================================================
--  بيانات تجريبية لتقريري «الأحداث والمناسبات» و«التقرير الشهري لشؤون
--  الطلاب» — للنسخة التجريبية فقط. يُشغَّل بعد seed.sql، وإعادته آمنة.
--  • أيام حضور معتمدة لأيام الدراسة الماضية من الشهر (ما عدا اليوم)،
--    وعلامات غياب وتأخر لبعض الطلاب، وإنذار غياب.
--  • ثلاثة أحداث بمشاركيها: اثنان معتمدان وواحد قيد التنفيذ.
--  لا يُستبدل شيء موجود: يوم اعتُمد فعلًا في التجربة يبقى كما هو.
-- =====================================================================

-- أيام الدراسة الماضية من الشهر الحالي (الأحد–الخميس)
create temp table demo_days as
select d::date as day, row_number() over (order by d) as k
  from generate_series(date_trunc('month', current_date), current_date - 1, interval '1 day') d
 where extract(dow from d) between 0 and 4;

-- علامة كل طالب في كل يوم: غياب أو تأخر بنمط ثابت، والبقية حضور
create temp table demo_marks as
select dd.day, s.id as student_id, s.full_name, c.class_no, c.grade,
       case when (dd.k + right(s.id::text, 2)::int) % 9 = 0 then 'absent'
            when (dd.k * 5 + right(s.id::text, 2)::int * 7) % 29 = 0 then 'excused' else 'present' end as status,
       case when (dd.k + right(s.id::text, 2)::int * 2) % 5 = 0 then (8 + (dd.k % 4) * 6)::int end as late_minutes
  from demo_days dd
  join public.students s on s.id::text like '00000000-0000-4000-e000-%'
  join public.student_enrollment e on e.student_id = s.id and e.academic_year = '1448'
  join public.classes c on c.id = e.class_id;

insert into public.official_attendance_days (attend_date, academic_year, term, total, present, absent, excused, pending, official_pct, by_grade, late_count, approved_by_name)
select m.day, '1448', 1, count(*), count(*) filter (where status = 'present'), count(*) filter (where status = 'absent'),
       count(*) filter (where status = 'excused'), 0,
       round(100.0 * count(*) filter (where status = 'present') / count(*), 2),
       (select jsonb_object_agg(g.grade, jsonb_build_object('total', g.t, 'present', g.p, 'absent', g.a, 'excused', g.x, 'pending', 0))
          from (select grade, count(*) t, count(*) filter (where status = 'present') p, count(*) filter (where status = 'absent') a,
                       count(*) filter (where status = 'excused') x
                  from demo_marks m2 where m2.day = m.day group by grade) g),
       count(*) filter (where late_minutes is not null and status = 'present'), 'اعتماد تجريبي'
  from demo_marks m group by m.day
on conflict (attend_date) do nothing;

insert into public.official_day_marks (attend_date, student_id, status, punched, full_name, class_no, grade, late_minutes, punch_time)
select m.day, m.student_id, m.status, m.status = 'present', m.full_name, m.class_no, m.grade,
       case when m.status = 'present' then m.late_minutes end,
       case when m.status = 'present' and m.late_minutes is not null then (m.day + time '07:15' + make_interval(mins => m.late_minutes)) at time zone 'Asia/Riyadh' end
  from demo_marks m
  join public.official_attendance_days d on d.attend_date = m.day and d.approved_by_name = 'اعتماد تجريبي'
on conflict (attend_date, student_id) do nothing;

-- إنذار غياب أول لأكثر الطلاب غيابًا
insert into public.absence_warnings (id, student_id, stage, days_count, academic_year, term, issued_on, issued_by_name)
select '00000000-0000-4000-9900-000000000001', '00000000-0000-4000-e000-000000000102', 'warn1', 10, '1448', 1,
       greatest(date_trunc('month', current_date)::date, current_date - 3), 'وكيل شؤون الطلاب (تجريبي)'
on conflict (id) do update set issued_on = excluded.issued_on;

-- الأحداث: اثنان معتمدان وواحد قيد التنفيذ، بتواريخ في الشهر الحالي
insert into public.school_events (id, serial, title, category, description, venue, event_date, organizer_id, organizer_name, organizer_role,
                                  stage, report_summary, approved_at, approved_by_name)
values
  ('00000000-0000-4000-9a00-000000000001', 'EV-DEMO-1', 'اليوم العالمي للصحة النفسية', 'توعية', 'فعالية توعوية بالصحة النفسية للطلاب.',
   'مسرح المدرسة', least(date_trunc('month', current_date)::date + 9, current_date), '00000000-0000-4000-a000-000000000021',
   'الموجه الطلابي للصف الأول (تجريبي)', 'الموجه الطلابي', 'approved', 'شارك الطلاب في ورش الوعي الذاتي وإدارة الضغوط، وقُدمت مطويات للأسر.', now() - interval '1 day', 'مدير المدرسة (تجريبي)'),
  ('00000000-0000-4000-9a00-000000000002', 'EV-DEMO-2', 'مسابقة الرياضيات الذهنية', 'علمي', 'مسابقة بين فصول المدرسة.',
   'قاعة النشاط', least(date_trunc('month', current_date)::date + 4, current_date), '00000000-0000-4000-a000-000000000011',
   'معلم الرياضيات (تجريبي)', 'معلم', 'approved', 'تنافس الطلاب في الحساب الذهني وكُرّم الفائزون.', now() - interval '3 days', 'مدير المدرسة (تجريبي)'),
  ('00000000-0000-4000-9a00-000000000003', 'EV-DEMO-3', 'زيارة مكتبة الحرم المكي', 'رحلة', 'رحلة معرفية لطلاب الصف الثالث.',
   'مكتبة الحرم', least(date_trunc('month', current_date)::date + 18, (date_trunc('month', current_date) + interval '1 month - 1 day')::date),
   '00000000-0000-4000-a000-000000000011', 'معلم الرياضيات (تجريبي)', 'معلم', 'consent', null, null, null)
on conflict (id) do update set event_date = excluded.event_date;

insert into public.event_participants (event_id, student_id, student_name, class_label, consent_at, attended, cert_issued_at)
select v.ev::uuid, s.id, s.full_name, null,
       now() - interval '5 days', case when v.done then true end, case when v.done then now() - interval '1 day' end
  from (values ('00000000-0000-4000-9a00-000000000001', true, '1'), ('00000000-0000-4000-9a00-000000000002', true, '2'),
               ('00000000-0000-4000-9a00-000000000003', false, '3')) v(ev, done, g)
  join public.students s on s.id::text like '00000000-0000-4000-e000-000000000' || v.g || '%'
on conflict (event_id, student_id) do nothing;
