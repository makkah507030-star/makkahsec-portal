-- =====================================================================
-- حصص الانتظار: حجز الحصة وحفظ تحضيرها في عملية واحدة على الخادم.
--
-- المشكلات التي يعالجها:
--   1) الحفظ كان خطوتين من المتصفح (حجز ثم تحضير)؛ إن فشلت الثانية بقي
--      الحجز عالقًا بلا تحضير.
--   2) إن حضّر المعلم الأصلي حصته بعد فتح معلم الانتظار الكشف وقبل حفظه،
--      كان الانتظار يكتب فوق تحضير المعلم الأصلي، ويُحتسب له انتظار وهمي.
--   3) مهلة الدقائق العشر وشرط «الحصة الجارية» كانت في الواجهة فقط.
--
-- الدالة substitute_take تتحقق من كل ذلك، وتقفل الحصة حتى لا يحضّرها
-- اثنان معًا، ثم تكتب الحجز والتحضير معًا: إمّا ينجحان معًا أو لا يُكتب شيء.
--
-- • تحتاج جدولي substitute_periods و class_attendance كما هما.
-- • يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- • قبل تنفيذه تعمل الواجهة بالطريقة القديمة تلقائيًا.
-- • انسخ الملف كاملًا واضغط Run دون تظليل جزء منه.
-- =====================================================================

create or replace function public.substitute_take(
  p_schedule_id public.schedule.id%type,
  p_date        date,
  p_marks       jsonb          -- { "<student_id>": "present|absent|late|excused", ... }
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_now     timestamp := now() at time zone 'Asia/Riyadh';
  v_grace   constant integer := 10;   -- يطابق GRACE_MINUTES في الواجهة
  v_me      public.teachers.id%type;
  v_sched   record;
  v_dow     integer;
  v_season  text;
  v_start   time;
  v_end     time;
  v_year    public.substitute_periods.academic_year%type;
  v_term    public.substitute_periods.term%type;
  v_holder  public.teachers.id%type;
  v_status  public.class_attendance.status%type;
  v_stu     record;
  v_count   integer := 0;
begin
  select t.id into v_me from public.teachers t where t.user_id = auth.uid();
  if v_me is null then
    raise exception 'هذه الخدمة للمعلمين فقط.' using errcode = 'insufficient_privilege';
  end if;

  if p_date is distinct from v_now::date then
    raise exception 'حصة الانتظار تُحضَّر في يومها فقط.' using errcode = 'check_violation';
  end if;

  select s.id, s.teacher_id, s.class_id, s.period_no, s.day_of_week
    into v_sched
  from public.schedule s where s.id = p_schedule_id;
  if not found then
    raise exception 'الحصة غير موجودة في الجدول.' using errcode = 'no_data_found';
  end if;

  if v_sched.teacher_id = v_me then
    raise exception 'هذه حصتك — حضّرها من شاشة التحضير.' using errcode = 'check_violation';
  end if;

  -- الأحد = 1 … الخميس = 5 (ترقيم النظام)
  v_dow := extract(dow from v_now)::integer + 1;
  if v_sched.day_of_week is distinct from v_dow then
    raise exception 'هذه الحصة ليست في جدول اليوم.' using errcode = 'check_violation';
  end if;

  select coalesce((select value from public.settings where key = 'active_season'), 'summer')
    into v_season;
  select pt.start_time::time, pt.end_time::time into v_start, v_end
  from public.period_times pt
  where pt.kind = 'period' and pt.period_no = v_sched.period_no and pt.season = v_season
  limit 1;

  if v_start is not null and v_now::time < v_start + make_interval(mins => v_grace) then
    raise exception 'يُفتح الانتظار بعد % دقائق من بداية الحصة (الساعة %).',
      v_grace, to_char(v_start + make_interval(mins => v_grace), 'HH12:MI')
      using errcode = 'check_violation';
  end if;

  -- معلم لديه حصة في جدوله الآن لا يغطّي فصلًا آخر في الوقت نفسه
  if exists (
    select 1 from public.schedule s2
    where s2.teacher_id = v_me
      and s2.day_of_week = v_sched.day_of_week
      and s2.period_no = v_sched.period_no
      and s2.id <> v_sched.id
      and s2.academic_year::text = (select value from public.settings where key = 'active_year')
      and s2.term::text = coalesce((select value from public.settings where key = 'active_term'), '1')
  ) then
    raise exception 'لديك حصة في جدولك في الوقت نفسه، فلا يمكنك تغطية فصل آخر.'
      using errcode = 'check_violation';
  end if;

  -- قفل الحصة لهذا اليوم حتى نهاية العملية: لا يحضّرها اثنان في اللحظة نفسها
  perform pg_advisory_xact_lock(hashtext(p_schedule_id::text), hashtext(p_date::text));

  select sp.cover_teacher_id into v_holder
  from public.substitute_periods sp
  where sp.schedule_id = p_schedule_id and sp.attend_date = p_date;

  if v_holder is not null and v_holder <> v_me then
    raise exception 'سبقك معلم آخر لتحضير هذه الحصة.' using errcode = 'unique_violation';
  end if;

  -- حضّرها أحد قبلي (غالبًا معلمها الأصلي): لا أكتب فوق تحضيره
  if v_holder is null and exists (
    select 1 from public.class_attendance ca
    where ca.schedule_id = p_schedule_id and ca.attend_date = p_date
  ) then
    raise exception 'حُضِّرت هذه الحصة قبل حفظك — غالبًا حضر معلمها.' using errcode = 'unique_violation';
  end if;

  v_year := (select value from public.settings where key = 'active_year');
  v_term := coalesce((select value from public.settings where key = 'active_term'), '1');

  insert into public.substitute_periods (
    schedule_id, class_id, cover_teacher_id, absent_teacher_id,
    attend_date, period_no, day_of_week, academic_year, term
  ) values (
    p_schedule_id, v_sched.class_id, v_me, v_sched.teacher_id,
    p_date, v_sched.period_no, v_sched.day_of_week, v_year, v_term
  )
  on conflict (schedule_id, attend_date) do nothing;

  -- كشف الفصل من القاعدة نفسها (الطلاب المنتظمون)، والحالة من اختيار المعلم،
  -- ومن لم تصل حالته يُعدّ حاضرًا
  for v_stu in
    select e.student_id from public.student_enrollment e
    where e.class_id = v_sched.class_id and e.status = 'active'
  loop
    v_status := case
      when p_marks ->> v_stu.student_id::text in ('present', 'absent', 'late', 'excused')
        then p_marks ->> v_stu.student_id::text
      else 'present' end;

    insert into public.class_attendance (
      student_id, schedule_id, attend_date, status, recorded_by, academic_year
    ) values (
      v_stu.student_id, p_schedule_id, p_date, v_status, auth.uid(), v_year
    )
    on conflict (student_id, schedule_id, attend_date)
    do update set status = excluded.status, recorded_by = excluded.recorded_by;

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'لا طلاب منتظمون في هذا الفصل.' using errcode = 'no_data_found';
  end if;
  return v_count;
end;
$fn$;

revoke all on function public.substitute_take(public.schedule.id%type, date, jsonb) from public;
grant execute on function public.substitute_take(public.schedule.id%type, date, jsonb) to authenticated;

-- للمراجعة: حجوزات بلا تحضير (يجب أن تكون صفرًا بعد تفعيل الدالة)
-- select sp.* from public.substitute_periods sp
-- where not exists (select 1 from public.class_attendance ca
--                   where ca.schedule_id = sp.schedule_id and ca.attend_date = sp.attend_date);
