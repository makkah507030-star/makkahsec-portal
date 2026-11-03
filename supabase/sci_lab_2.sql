-- مختبرات العلوم (2 من 6): حراسة الحجز وسجل التنفيذ، وفصول المعلم في مادة المختبر. يُنفَّذ بعد الجزء 1. تكرار التنفيذ آمن.

-- الحجز: حالة التجهيز للمحضر وحده، ويُسجَّل وقتها
create or replace function public.sci_bookings_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not public.sci_manager(new.lab) then new.prep := 'pending'; new.prep_note := null; new.prep_at := null;
    elsif new.prep <> 'pending' then new.prep_at := now(); end if;
  elsif not public.sci_manager(new.lab) then
    new.prep := old.prep; new.prep_note := old.prep_note; new.prep_at := old.prep_at;
    new.lab := old.lab; new.teacher_id := old.teacher_id;
  elsif new.prep is distinct from old.prep or new.prep_note is distinct from old.prep_note then
    new.prep_at := now();
  end if;
  return new;
end; $$;
drop trigger if exists sci_bookings_guard on public.sci_bookings;
create trigger sci_bookings_guard before insert or update on public.sci_bookings
  for each row execute function public.sci_bookings_guard();

-- سجل التنفيذ: العام النشط، وسبب عدم التنفيذ لازم، والاعتماد للمحضر وحده ويسقط إن عدّل المعلم بعده
create or replace function public.sci_runs_guard() returns trigger
language plpgsql set search_path = public as $$
declare mgr boolean := public.sci_manager((select lab from sci_experiments where id = new.experiment_id));
begin
  new.academic_year := coalesce(nullif(new.academic_year, ''), (select value from settings where key = 'active_year'));
  if new.outcome <> 'not_done' then new.reason := null; new.reason_note := null;
  elsif new.reason is null then raise exception 'اختر سبب عدم تنفيذ التجربة'; end if;
  if mgr then
    if new.confirmed_at is not null and (tg_op = 'INSERT' or old.confirmed_at is null) then
      new.confirmed_by_name := (select full_name from users where id = auth.uid());
    elsif new.confirmed_at is null then new.confirmed_by_name := null; end if;
  else
    new.confirmed_at := null; new.confirmed_by_name := null;
  end if;
  return new;
end; $$;
drop trigger if exists sci_runs_guard on public.sci_runs;
create trigger sci_runs_guard before insert or update on public.sci_runs
  for each row execute function public.sci_runs_guard();

-- فصول المعلم في مادة المختبر من جدوله (وللمحضر وللإدارة: فصول المادة كلها) مع صف كل فصل ومعلمه
create or replace function public.sci_classes(p_lab text)
returns table (class_id uuid, grade int, class_no int, teacher_id uuid, teacher_name text, subject text)
language sql stable security definer set search_path = public as $$
  select distinct c.id, c.grade::int, c.class_no::int, t.id, t.full_name, b.name
    from schedule s join subjects b on b.id = s.subject_id join classes c on c.id = s.class_id
    join teachers t on t.id = s.teacher_id join sci_labs l on l.key = p_lab
   where s.academic_year = (select value from settings where key = 'active_year') and b.name ~ l.pattern
     and (public.sci_manager(p_lab) or t.user_id = auth.uid())
   order by 2, 3;
$$;
revoke execute on function public.sci_classes(text) from public, anon;
grant execute on function public.sci_classes(text) to authenticated;

-- نهاية الجزء 2
