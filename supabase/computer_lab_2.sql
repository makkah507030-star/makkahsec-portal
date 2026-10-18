-- =====================================================================
-- معمل الحاسب الآلي (2 من 2): دوال الحجز والإلغاء وعرض الأسبوع
-- يُنفَّذ بعد computer_lab_1.sql. تكرار التنفيذ آمن.
-- =====================================================================

-- حجز حصة، أو تكرارها أسبوعيًا (حتى 20 أسبوعًا). الحصة المحجوزة سلفًا
-- أو الواقعة في إجازة رسمية تُتخطّى وتُعاد في النتيجة.
create or replace function public.lab_book(
  p_lab smallint, p_date date, p_period integer,
  p_class uuid default null, p_lesson text default null, p_weeks integer default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tid uuid := public.current_teacher_id();
  v_today date := (now() at time zone 'Asia/Riyadh')::date;
  v_series uuid := case when coalesce(p_weeks, 1) > 1 then gen_random_uuid() end;
  v_booked date[] := '{}'; v_taken date[] := '{}'; v_off date[] := '{}';
  v_d date; v_id uuid;
begin
  if v_tid is null or not public.lab_can_book() then
    raise exception 'غير مخوّل بحجز المعمل';
  end if;
  if not exists (select 1 from public.labs where id = p_lab and is_active) then
    raise exception 'المعمل غير متاح';
  end if;
  if p_date < v_today then raise exception 'لا يمكن الحجز في يوم مضى'; end if;
  if extract(dow from p_date) not between 0 and 4 then raise exception 'الحجز من الأحد إلى الخميس'; end if;
  if p_period not between 1 and 8 then raise exception 'رقم الحصة غير صحيح'; end if;

  for i in 0 .. least(greatest(coalesce(p_weeks, 1), 1), 20) - 1 loop
    v_d := p_date + i * 7;
    if exists (select 1 from public.academic_calendar c
                where c.kind = 'holiday' and c.is_active
                  and v_d between c.start_date and coalesce(c.end_date, c.start_date)) then
      v_off := v_off || v_d; continue;
    end if;
    v_id := null;
    insert into public.lab_bookings (lab_id, booking_date, period_no, teacher_id, class_id, lesson, series_id)
    values (p_lab, v_d, p_period, v_tid, p_class, nullif(trim(p_lesson), ''), v_series)
    on conflict (lab_id, booking_date, period_no) do nothing
    returning id into v_id;
    if v_id is null then v_taken := v_taken || v_d; else v_booked := v_booked || v_d; end if;
  end loop;
  return jsonb_build_object('booked', to_jsonb(v_booked), 'taken', to_jsonb(v_taken), 'off', to_jsonb(v_off));
end $$;

-- إلغاء حجز (أو ما بقي من سلسلته المتكررة): لصاحبه ولمسؤولي المعمل
create or replace function public.lab_cancel(p_id uuid, p_series boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
declare b public.lab_bookings; n integer;
begin
  select * into b from public.lab_bookings where id = p_id;
  if not found then return 0; end if;
  if b.teacher_id is distinct from public.current_teacher_id() and not public.lab_is_manager() then
    raise exception 'لا يمكنك إلغاء حجز غيرك';
  end if;
  delete from public.lab_bookings x
   where x.id = b.id
      or (p_series and b.series_id is not null and x.series_id = b.series_id and x.booking_date >= b.booking_date);
  get diagnostics n = row_count;
  return n;
end $$;

-- حجوزات فترة مع اسم المعلم والفصل
create or replace function public.lab_week(p_lab smallint, p_from date, p_to date)
returns table (id uuid, booking_date date, period_no integer, teacher_id uuid, teacher_name text,
               class_id uuid, class_no integer, grade integer, lesson text, series_id uuid, mine boolean)
language sql stable security definer set search_path = public as $$
  select b.id, b.booking_date, b.period_no, b.teacher_id, t.full_name,
         b.class_id, c.class_no, c.grade, b.lesson, b.series_id,
         b.teacher_id = public.current_teacher_id()
    from public.lab_bookings b
    join public.teachers t on t.id = b.teacher_id
    left join public.classes c on c.id = b.class_id
   where public.lab_is_staff() and b.lab_id = p_lab and b.booking_date between p_from and p_to
   order by b.booking_date, b.period_no;
$$;

revoke execute on function public.lab_book(smallint, date, integer, uuid, text, integer) from public, anon;
revoke execute on function public.lab_cancel(uuid, boolean) from public, anon;
revoke execute on function public.lab_week(smallint, date, date) from public, anon;
grant execute on function public.lab_book(smallint, date, integer, uuid, text, integer) to authenticated;
grant execute on function public.lab_cancel(uuid, boolean) to authenticated;
grant execute on function public.lab_week(smallint, date, date) to authenticated;
-- نهاية الجزء 2
