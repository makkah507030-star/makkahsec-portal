-- =====================================================================
-- حصة الانتظار: إعادة التحضير حتى قبل نهاية الحصة بخمس دقائق
-- • substitute_check: يُغلق التحضير (الأول وإعادته) قبل نهاية الحصة بـ 5 دقائق.
-- • substitute_marks: ما حفظه معلم الانتظار نفسه لهذه الحصة، ليعدّل عليه.
-- يُنفَّذ بعد substitute_take_1 و2. تكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.substitute_check(
  p_schedule_id public.schedule.id%type, p_date date)
returns public.teachers.id%type
language plpgsql stable security definer set search_path = public
as $fn$
declare
  v_now  timestamp := now() at time zone 'Asia/Riyadh';
  v_me   public.teachers.id%type;
  v_s    record;
  v_st   time;
  v_en   time;
begin
  select t.id into v_me from teachers t where t.user_id = auth.uid();
  if v_me is null then raise exception 'هذه الخدمة للمعلمين فقط.' using errcode = '42501'; end if;
  if p_date is distinct from v_now::date then
    raise exception 'حصة الانتظار تُحضَّر في يومها فقط.' using errcode = '23514';
  end if;
  select s.id, s.teacher_id, s.period_no, s.day_of_week into v_s from schedule s where s.id = p_schedule_id;
  if not found then raise exception 'الحصة غير موجودة في الجدول.' using errcode = 'P0002'; end if;
  if v_s.teacher_id = v_me then
    raise exception 'هذه حصتك، حضّرها من شاشة التحضير.' using errcode = '23514';
  end if;
  if v_s.day_of_week is distinct from extract(dow from v_now)::int + 1 then
    raise exception 'هذه الحصة ليست في جدول اليوم.' using errcode = '23514';
  end if;
  select pt.start_time::time, pt.end_time::time into v_st, v_en from period_times pt
   where pt.kind = 'period' and pt.period_no = v_s.period_no
     and pt.season = coalesce((select value from settings where key = 'active_season'), 'summer')
   limit 1;
  if v_st is not null and v_now::time < v_st + interval '10 minutes' then
    raise exception 'يُفتح الانتظار بعد ١٠ دقائق من بداية الحصة.' using errcode = '23514';
  end if;
  if v_en is not null and v_now::time > v_en - interval '5 minutes' then
    raise exception 'انتهى وقت تحضير هذه الحصة (قبل نهايتها بخمس دقائق).' using errcode = '23514';
  end if;
  if exists (
    select 1 from schedule s2
     where s2.teacher_id = v_me and s2.id <> v_s.id
       and s2.day_of_week = v_s.day_of_week and s2.period_no = v_s.period_no
       and s2.academic_year::text = (select value from settings where key = 'active_year')
       and s2.term::text = coalesce((select value from settings where key = 'active_term'), '1')
  ) then
    raise exception 'لديك حصة في جدولك في الوقت نفسه، فلا يمكنك تغطية فصل آخر.' using errcode = '23514';
  end if;
  return v_me;
end;
$fn$;
revoke all on function public.substitute_check(public.schedule.id%type, date) from public, anon;

create or replace function public.substitute_marks(p_schedule_id public.schedule.id%type, p_date date)
returns table (student_id uuid, status text)
language sql stable security definer set search_path = public as $$
  select ca.student_id, ca.status::text from class_attendance ca
   where ca.schedule_id = p_schedule_id and ca.attend_date = p_date
     and exists (select 1 from substitute_periods sp join teachers t on t.id = sp.cover_teacher_id
                  where sp.schedule_id = p_schedule_id and sp.attend_date = p_date and t.user_id = auth.uid());
$$;
revoke all on function public.substitute_marks(public.schedule.id%type, date) from public, anon;
grant execute on function public.substitute_marks(public.schedule.id%type, date) to authenticated;
-- نهاية الجزء 1
