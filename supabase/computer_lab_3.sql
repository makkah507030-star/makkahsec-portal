-- =====================================================================
-- معمل الحاسب الآلي (3): خريطة جلوس الطلاب — لكل فصل خريطته، وقد يجلس على
-- الجهاز الواحد أكثر من طالب. يُنفَّذ بعد الجزأين 1 و2. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.lab_seats (
  lab_id smallint not null references public.labs(id),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  seat_no integer not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (lab_id, class_id, student_id)
);
alter table public.lab_seats enable row level security;
drop policy if exists "lab seats read" on public.lab_seats;
create policy "lab seats read" on public.lab_seats for select to authenticated using (public.lab_can_view());

-- فصول العام الدراسي الحالي مع عدد طلابها ومن وُزّع منهم
create or replace function public.lab_classes(p_lab smallint)
returns table (class_id uuid, class_no integer, grade integer, students integer, seated integer)
language sql stable security definer set search_path = public as $$
  select c.id, c.class_no, c.grade,
         (select count(*)::int from public.student_enrollment e
           where e.class_id = c.id and e.status = 'active'),
         (select count(*)::int from public.lab_seats s where s.lab_id = p_lab and s.class_id = c.id)
    from public.classes c
   where public.lab_can_view() and c.is_active
     and c.academic_year = (select value from public.settings where key = 'active_year')
   order by c.class_no;
$$;

-- طلاب الفصل وأجهزتهم (seat_no فارغ لمن لم يوزَّع)
create or replace function public.lab_class_seats(p_lab smallint, p_class uuid)
returns table (student_id uuid, full_name text, seat_no integer)
language sql stable security definer set search_path = public as $$
  select st.id, st.full_name, s.seat_no
    from public.student_enrollment e
    join public.students st on st.id = e.student_id
    left join public.lab_seats s on s.lab_id = p_lab and s.class_id = p_class and s.student_id = st.id
   where public.lab_can_view() and e.class_id = p_class and e.status = 'active'
   order by st.full_name;
$$;

-- حفظ خريطة فصل كاملة: [{student_id, seat_no}] تحل محل السابقة
create or replace function public.lab_seats_save(p_lab smallint, p_class uuid, p_seats jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not (public.lab_can_book() or public.lab_is_manager()) then
    raise exception 'غير مخوّل بتعديل خريطة الجلوس';
  end if;
  delete from public.lab_seats where lab_id = p_lab and class_id = p_class;
  insert into public.lab_seats (lab_id, class_id, student_id, seat_no, updated_by)
  select p_lab, p_class, x.student_id, x.seat_no, auth.uid()
    from jsonb_to_recordset(coalesce(p_seats, '[]')) as x(student_id uuid, seat_no integer)
   where exists (select 1 from public.student_enrollment e
                  where e.class_id = p_class and e.student_id = x.student_id and e.status = 'active')
     and exists (select 1 from public.lab_devices d where d.lab_id = p_lab and d.seat_no = x.seat_no)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- جهاز الطالب نفسه (لصفحة الطالب)
create or replace function public.lab_my_seat()
returns table (lab_name text, seat_no integer, code text, status text)
language sql stable security definer set search_path = public as $$
  select l.name, s.seat_no, d.code, d.status
    from public.lab_seats s
    join public.labs l on l.id = s.lab_id and l.is_active
    join public.student_enrollment e on e.student_id = s.student_id and e.class_id = s.class_id and e.status = 'active'
    left join public.lab_devices d on d.lab_id = s.lab_id and d.seat_no = s.seat_no
   where s.student_id = public.current_student_id();
$$;

revoke execute on function public.lab_classes(smallint), public.lab_class_seats(smallint, uuid),
  public.lab_seats_save(smallint, uuid, jsonb), public.lab_my_seat() from public, anon;
grant execute on function public.lab_classes(smallint), public.lab_class_seats(smallint, uuid),
  public.lab_seats_save(smallint, uuid, jsonb), public.lab_my_seat() to authenticated;
-- نهاية الجزء 3
