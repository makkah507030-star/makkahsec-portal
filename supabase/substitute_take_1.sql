-- حصص الانتظار (١ من ٢): فحص صلاحية المعلم للانتظار الآن.
-- يُنفَّذ قبل الملف ٢، وكلٌّ منهما في استعلام مستقل. تكرار التنفيذ آمن.
-- يرجع معرّف المعلم، أو يرفض: غير معلم، غير يوم الحصة، حصته هو،
-- قبل مرور ١٠ دقائق على بدايتها، أو له حصة في الوقت نفسه.

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
begin
  select t.id into v_me from teachers t where t.user_id = auth.uid();
  if v_me is null then
    raise exception 'هذه الخدمة للمعلمين فقط.' using errcode = '42501';
  end if;
  if p_date is distinct from v_now::date then
    raise exception 'حصة الانتظار تُحضَّر في يومها فقط.' using errcode = '23514';
  end if;

  select s.id, s.teacher_id, s.period_no, s.day_of_week into v_s
  from schedule s where s.id = p_schedule_id;
  if not found then
    raise exception 'الحصة غير موجودة في الجدول.' using errcode = 'P0002';
  end if;
  if v_s.teacher_id = v_me then
    raise exception 'هذه حصتك، حضّرها من شاشة التحضير.' using errcode = '23514';
  end if;
  if v_s.day_of_week is distinct from extract(dow from v_now)::int + 1 then
    raise exception 'هذه الحصة ليست في جدول اليوم.' using errcode = '23514';
  end if;

  select pt.start_time::time into v_st from period_times pt
  where pt.kind = 'period' and pt.period_no = v_s.period_no
    and pt.season = coalesce((select value from settings where key = 'active_season'), 'summer')
  limit 1;
  if v_st is not null and v_now::time < v_st + interval '10 minutes' then
    raise exception 'يُفتح الانتظار بعد ١٠ دقائق من بداية الحصة.' using errcode = '23514';
  end if;

  if exists (
    select 1 from schedule s2
    where s2.teacher_id = v_me and s2.id <> v_s.id
      and s2.day_of_week = v_s.day_of_week and s2.period_no = v_s.period_no
      and s2.academic_year::text = (select value from settings where key = 'active_year')
      and s2.term::text = coalesce((select value from settings where key = 'active_term'), '1')
  ) then
    raise exception 'لديك حصة في جدولك في الوقت نفسه، فلا يمكنك تغطية فصل آخر.'
      using errcode = '23514';
  end if;

  return v_me;
end;
$fn$;

revoke all on function public.substitute_check(public.schedule.id%type, date) from public, anon;
