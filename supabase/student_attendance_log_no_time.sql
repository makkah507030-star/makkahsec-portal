-- =====================================================================
-- سجل الحضور للطالب وولي أمره — إضافة late_no_time:
-- البصمة تتوقف مع بداية الحصة الأولى، فمن لم يبصم وحضر الحصص يُعتمد
-- «متأخرًا بلا وقت» (دقيقة رمزية بلا وقت بصمة). late_no_time يميّزه
-- فيظهر للطالب وولي الأمر «متأخر (بلا وقت)» بدل «متأخر 1 د».
-- تغيّر نوع الإرجاع فتُحذف الدالة ثم تُنشأ. تكرار التنفيذ آمن.
-- =====================================================================

drop function if exists public.student_attendance_log(uuid, date);

create or replace function public.student_attendance_log(p_student uuid, p_from date)
returns table (attend_date date, official text, approved boolean, late_minutes integer, periods jsonb,
               late_no_time boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (exists (select 1 from students s where s.id = p_student and s.user_id = auth.uid())
          or exists (select 1 from guardian_student gs join guardians g on g.id = gs.guardian_id
                      where gs.student_id = p_student and g.user_id = auth.uid())
          or public.sa_is_staff()) then
    raise exception 'غير مصرّح';
  end if;

  return query
  with per as (     -- الحصص غير الحاضرة
    select ca.attend_date as d,
           jsonb_agg(jsonb_build_object('p', sc.period_no, 'subject', sb.name, 'status', ca.status::text)
                     order by sc.period_no) as periods
      from class_attendance ca
      join schedule sc on sc.id = ca.schedule_id
      left join subjects sb on sb.id = sc.subject_id
     where ca.student_id = p_student and ca.status <> 'present' and ca.attend_date >= p_from
     group by ca.attend_date
  ),
  off as (          -- الحالة الرسمية للأيام المعتمدة
    select m.attend_date as d, m.status, coalesce(m.late_minutes, 0) as late,
           (coalesce(m.late_minutes, 0) > 0 and m.punch_time is null) as no_time
      from official_day_marks m
     where m.student_id = p_student and m.attend_date >= p_from
  ),
  days as (
    select d from per union select d from off
  )
  select days.d,
         case when off.d is not null then off.status
              when exists (select 1 from official_attendance_days od where od.attend_date = days.d) then 'present'
         end,
         exists (select 1 from official_attendance_days od where od.attend_date = days.d),
         coalesce(off.late, 0),
         coalesce(per.periods, '[]'::jsonb),
         coalesce(off.no_time, false)
    from days
    left join per on per.d = days.d
    left join off on off.d = days.d
   order by days.d desc;
end;
$$;

revoke execute on function public.student_attendance_log(uuid, date) from public, anon;
grant  execute on function public.student_attendance_log(uuid, date) to authenticated;
-- نهاية الجزء 1
