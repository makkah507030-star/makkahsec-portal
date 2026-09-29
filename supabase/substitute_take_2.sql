-- حصص الانتظار (٢ من ٢): حجز الحصة وحفظ تحضيرها معًا في عملية واحدة.
-- يُنفَّذ بعد الملف ١. تكرار التنفيذ آمن.
-- تقفل الحصة حتى لا يحضّرها اثنان معًا، ولا تكتب فوق تحضير معلمها.
-- p_marks: { "<student_id>": "present|absent|late|excused" }، ومن لم تصل حالته حاضر.

create or replace function public.substitute_take(
  p_schedule_id public.schedule.id%type, p_date date, p_marks jsonb)
returns integer
language plpgsql security definer set search_path = public
as $fn$
declare
  v_me     public.teachers.id%type := substitute_check(p_schedule_id, p_date);
  v_s      record;
  v_holder public.teachers.id%type;
  v_year   public.substitute_periods.academic_year%type;
  v_term   public.substitute_periods.term%type;
  v_st     public.class_attendance.status%type;
  v_stu    record;
  v_n      integer := 0;
begin
  select s.teacher_id, s.class_id, s.period_no, s.day_of_week into v_s
  from schedule s where s.id = p_schedule_id;

  perform pg_advisory_xact_lock(hashtext(p_schedule_id::text), hashtext(p_date::text));

  select sp.cover_teacher_id into v_holder from substitute_periods sp
  where sp.schedule_id = p_schedule_id and sp.attend_date = p_date;
  if v_holder is not null and v_holder <> v_me then
    raise exception 'سبقك معلم آخر لتحضير هذه الحصة.' using errcode = '23505';
  end if;
  if v_holder is null and exists (
    select 1 from class_attendance ca
    where ca.schedule_id = p_schedule_id and ca.attend_date = p_date
  ) then
    raise exception 'حُضِّرت هذه الحصة قبل حفظك، غالبًا حضر معلمها.' using errcode = '23505';
  end if;

  v_year := (select value from settings where key = 'active_year');
  v_term := coalesce((select value from settings where key = 'active_term'), '1');

  insert into substitute_periods (schedule_id, class_id, cover_teacher_id,
    absent_teacher_id, attend_date, period_no, day_of_week, academic_year, term)
  values (p_schedule_id, v_s.class_id, v_me, v_s.teacher_id, p_date,
    v_s.period_no, v_s.day_of_week, v_year, v_term)
  on conflict (schedule_id, attend_date) do nothing;

  for v_stu in
    select e.student_id from student_enrollment e
    where e.class_id = v_s.class_id and e.status = 'active'
  loop
    v_st := case when p_marks ->> v_stu.student_id::text
                      in ('present', 'absent', 'late', 'excused')
                 then p_marks ->> v_stu.student_id::text else 'present' end;
    insert into class_attendance (student_id, schedule_id, attend_date,
      status, recorded_by, academic_year)
    values (v_stu.student_id, p_schedule_id, p_date, v_st, auth.uid(), v_year)
    on conflict (student_id, schedule_id, attend_date)
    do update set status = excluded.status, recorded_by = excluded.recorded_by;
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then
    raise exception 'لا طلاب منتظمون في هذا الفصل.' using errcode = 'P0002';
  end if;
  return v_n;
end;
$fn$;

revoke all on function public.substitute_take(public.schedule.id%type, date, jsonb) from public, anon;
grant execute on function public.substitute_take(public.schedule.id%type, date, jsonb) to authenticated;
