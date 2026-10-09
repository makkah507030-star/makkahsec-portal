-- =====================================================================
-- سجل الحضور للطالب وولي أمره: الغياب الرسمي والتأخر الصباحي والحصص في
-- سطر واحد لكل يوم من p_from حتى اليوم.
--
-- • official: حالة اليوم المعتمد (absent | excused | pending | present)،
--   أو null إن لم يُعتمد اليوم بعد. late_minutes: التأخر الصباحي المعتمد.
-- • periods: الحصص غير الحاضرة [{ p, subject, status }].
-- يقرؤه الطالب لنفسه وولي الأمر لأبنائه فقط (official_day_marks للإدارة،
-- فالدالة تفتح للطالب سطره وحده). تكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.student_attendance_log(p_student uuid, p_from date)
returns table (attend_date date, official text, approved boolean, late_minutes integer, periods jsonb)
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
    select m.attend_date as d, m.status, coalesce(m.late_minutes, 0) as late
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
         coalesce(per.periods, '[]'::jsonb)
    from days
    left join per on per.d = days.d
    left join off on off.d = days.d
   order by days.d desc;
end;
$$;

revoke execute on function public.student_attendance_log(uuid, date) from public, anon;
grant  execute on function public.student_attendance_log(uuid, date) to authenticated;
-- نهاية الملف
