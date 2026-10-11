-- أرقام «الاستخدام الفعلي» لفيديو البوابة — من بداية الفصل الدراسي 14/09/2026 حتى اليوم
-- يُشغَّل في Supabase ← SQL Editor (قراءة فقط، لا يغيّر شيئًا)
with p as (select date '2026-09-14' as d0)
select 1 as ord, 'سجل حضور (حصة بحصة)' as label, count(*)::text as value
  from public.class_attendance, p where attend_date >= p.d0
union all
select 2, 'إشعارًا وصل', count(*)::text
  from public.notification_recipients nr
  join public.notifications n on n.id = nr.notification_id, p
  where n.created_at >= p.d0
union all
select 3, 'حصة حُضِّرت من الجوال', count(distinct (schedule_id, attend_date))::text
  from public.class_attendance, p where attend_date >= p.d0
union all
select 4, 'حسابًا دخل البوابة', count(*)::text
  from auth.users where last_sign_in_at is not null
union all
select 5, 'منهم معلمًا', count(*)::text
  from auth.users a join public.users u on u.id = a.id
  where a.last_sign_in_at is not null and u.role = 'teacher'
union all
select 6, 'خانة في سجل المتابعة', count(*)::text
  from public.teacher_follow_up
union all
select 7, 'يوم غياب اعتُمد آليًا', count(*)::text
  from public.official_attendance_days, p where attend_date >= p.d0 and final_at is not null
union all
select 8, 'نموذجًا ومستندًا صدر', count(*)::text
  from public.form_documents, p where created_at >= p.d0 and status <> 'draft'
union all
select 9, 'إحالة طالب', count(*)::text
  from public.student_referrals, p where created_at >= p.d0
union all
select 10, 'اختبارًا في البوابة', count(*)::text
  from public.quizzes, p where created_at >= p.d0
order by ord;
-- نهاية الاستعلام
