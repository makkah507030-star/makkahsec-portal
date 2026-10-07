-- =====================================================================
-- مسار الطالب في اليوم: كل حصص جدول فصله، لا المحضّرة فقط
--
-- كانت student_day_timeline ترجع الحصص التي رُصد فيها تحضير الطالب فقط،
-- فتختفي الحصة التي لم يحضّرها معلمها (مثل الحصة الأولى). الآن ترجع كل حصص
-- جدول فصل الطالب في ذلك اليوم، وحالة الحصة غير المحضّرة فارغة (null)
-- فتظهر «لم يُحضَّر» في صندوق الطلاب المفقودين وفي إحالة الطالب المفقود.
-- وتبقى أي حصة رُصد فيها خارج جدول فصله (كحصة انتظار) كما كانت.
--
-- التوقيع والأعمدة نفسها، فلا يتغيّر شيء في الواجهة سوى ظهور الحصص الناقصة.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.student_day_timeline(p_date date, p_student_id uuid)
returns table (punch_time timestamptz, period_no integer, subject text, teacher text, status text)
language sql
stable security definer
set search_path = public
as $$
  with cls as (
    select se.class_id
    from student_enrollment se
    where se.student_id = p_student_id
      and se.status = 'active'
      and se.academic_year = public.active_year()
    limit 1
  ),
  att as (
    select ca.schedule_id, ca.status::text as status
    from class_attendance ca
    where ca.student_id = p_student_id and ca.attend_date = p_date
  ),
  ids as (
    -- حصص جدول الفصل في يوم الأسبوع (الأحد = 1 … الخميس = 5)
    select sc.id
    from schedule sc join cls on cls.class_id = sc.class_id
    where sc.academic_year = public.active_year()
      and sc.term = public.active_term()
      and sc.day_of_week = extract(dow from p_date)::int + 1
    union
    -- وأي حصة رُصد فيها الطالب ذلك اليوم
    select att.schedule_id from att
  )
  select
    (select da.punch_time from daily_attendance da
       where da.student_id = p_student_id and da.attend_date = p_date limit 1) as punch_time,
    sc.period_no,
    sub.name as subject,
    t.full_name as teacher,
    att.status
  from ids
  join schedule sc on sc.id = ids.id
  left join att on att.schedule_id = sc.id
  left join subjects sub on sub.id = sc.subject_id
  left join teachers t on t.id = sc.teacher_id
  order by sc.period_no;
$$;

-- للتحقق: يرجع الدالة بعد التعديل (يُفترض أن يظهر فيها union وschedule)
select left(pg_get_functiondef('public.student_day_timeline(date, uuid)'::regprocedure), 120) as def;
