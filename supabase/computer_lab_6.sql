-- =====================================================================
-- معمل الحاسب الآلي (6): سجل الاستخدام — الحجز يصير سجلًا بعد الحصة، ويؤكد
-- المعلم «تمت» أو «لم تُستخدم» مع ملاحظة، ويسجّل استخدامًا بلا حجز سابق.
-- يُنفَّذ بعد الأجزاء 1-5. تكرار التنفيذ آمن.
-- =====================================================================

alter table public.lab_bookings
  add column if not exists used boolean,                         -- فارغ = لم يؤكَّد (يُحتسب مستخدمًا)
  add column if not exists note text,
  add column if not exists walk_in boolean not null default false; -- سُجّل بعد الحصة بلا حجز

-- تأكيد الحصة بعد وقتها: لصاحبها ولمسؤولي المعمل
create or replace function public.lab_usage_mark(p_id uuid, p_used boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare b public.lab_bookings;
begin
  select * into b from public.lab_bookings where id = p_id;
  if not found then raise exception 'الحصة غير موجودة'; end if;
  if b.teacher_id is distinct from public.current_teacher_id() and not public.lab_is_manager() then
    raise exception 'لا يمكنك تعديل حصة غيرك';
  end if;
  if b.booking_date > (now() at time zone 'Asia/Riyadh')::date then raise exception 'لم يحن وقت الحصة بعد'; end if;
  update public.lab_bookings set used = p_used, note = nullif(trim(p_note), '') where id = p_id;
end $$;

-- استخدام بلا حجز سابق (اليوم أو خلال 30 يومًا مضت)
create or replace function public.lab_usage_add(
  p_lab smallint, p_date date, p_period integer, p_class uuid default null,
  p_lesson text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Asia/Riyadh')::date; v_id uuid;
begin
  if public.current_teacher_id() is null or not public.lab_can_book() then raise exception 'غير مخوّل'; end if;
  if p_date > v_today or p_date < v_today - 30 then raise exception 'التاريخ خارج المدة المسموحة (آخر 30 يومًا)'; end if;
  if extract(dow from p_date) not between 0 and 4 then raise exception 'الأيام من الأحد إلى الخميس'; end if;
  insert into public.lab_bookings (lab_id, booking_date, period_no, teacher_id, class_id, lesson, used, note, walk_in)
  values (p_lab, p_date, p_period, public.current_teacher_id(), p_class,
          nullif(trim(p_lesson), ''), true, nullif(trim(p_note), ''), true)
  on conflict (lab_id, booking_date, period_no) do nothing
  returning id into v_id;
  if v_id is null then raise exception 'هذه الحصة مسجّلة في المعمل لمعلم آخر'; end if;
  return v_id;
end $$;

-- سجل الاستخدام لفترة (للتقرير): كل ما مضى وقته، مع اسم المعلم والفصل
create or replace function public.lab_usage(p_lab smallint, p_from date, p_to date)
returns table (id uuid, booking_date date, period_no integer, teacher_id uuid, teacher_name text,
               class_no integer, grade integer, lesson text, used boolean, note text,
               walk_in boolean, mine boolean)
language sql stable security definer set search_path = public as $$
  select b.id, b.booking_date, b.period_no, b.teacher_id, t.full_name, c.class_no, c.grade,
         b.lesson, b.used, b.note, b.walk_in, b.teacher_id = public.current_teacher_id()
    from public.lab_bookings b
    join public.teachers t on t.id = b.teacher_id
    left join public.classes c on c.id = b.class_id
   where public.lab_can_view() and b.lab_id = p_lab
     and b.booking_date between p_from and least(p_to, (now() at time zone 'Asia/Riyadh')::date)
   order by b.booking_date, b.period_no;
$$;

revoke execute on function public.lab_usage_mark(uuid, boolean, text),
  public.lab_usage_add(smallint, date, integer, uuid, text, text),
  public.lab_usage(smallint, date, date) from public, anon;
grant execute on function public.lab_usage_mark(uuid, boolean, text),
  public.lab_usage_add(smallint, date, integer, uuid, text, text),
  public.lab_usage(smallint, date, date) to authenticated;
-- نهاية الجزء 6
