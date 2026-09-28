-- =====================================================================
-- الغياب بعذر: تحويل الغياب الرسمي إلى «بعذر» (أو إعادته «بدون عذر»)
-- متاح لوكيل شؤون الطلاب والمساعد الإداري 1 و 2، ومعهم المدير والدعم الفني.
--
-- الغياب يبقى «بدون عذر» تلقائيًا كما هو؛ هذا فقط يحدّد من يغيّر نوعه.
-- بقية التصحيحات (حاضر ↔ غائب) تبقى لمن له صلاحية الإدارة كما كانت.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- يتطلب تنفيذ student_affairs.sql قبله.
-- =====================================================================

create or replace function public.sa_can_excuse()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_roles ar
    where ar.user_id = auth.uid()
      and ar.role_type in ('principal', 'tech_support', 'deputy_students', 'clerk', 'clerk_2')
  );
$$;

revoke execute on function public.sa_can_excuse() from public, anon;
grant  execute on function public.sa_can_excuse() to authenticated;

create or replace function public.sa_override_mark(
  p_date date, p_student jsonb, p_status text, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_prev text;
begin
  if p_status not in ('present', 'absent', 'excused') then
    raise exception 'حالة غير صالحة: %', p_status;
  end if;
  if not exists (select 1 from public.official_attendance_days where attend_date = p_date) then
    raise exception 'هذا اليوم لم يُعتمد بعد';
  end if;

  select status into v_prev from public.official_day_marks
  where attend_date = p_date and student_id = (p_student->>'student_id')::uuid;

  -- العذر: منحه أو سحبه
  if p_status = 'excused' or v_prev = 'excused' then
    if not public.sa_can_excuse() then
      raise exception 'غير مصرّح: تعديل الغياب بعذر لوكيل شؤون الطلاب والمساعد الإداري 1 و 2';
    end if;
  elsif not (public.sa_can_manage() or public.sa_can_excuse()) then
    raise exception 'غير مصرّح: تعديل الغياب الرسمي لوكيل شؤون الطلاب والإدارة';
  end if;

  insert into public.official_day_marks as m (
    attend_date, student_id, status, punched, full_name, national_id, class_no, grade,
    manual, note, edited_by_name, edited_at)
  values (
    p_date, (p_student->>'student_id')::uuid, p_status,
    coalesce((p_student->>'punched')::boolean, false),
    p_student->>'full_name', p_student->>'national_id',
    nullif(p_student->>'class_no', '')::int, nullif(p_student->>'grade', '')::int,
    true, p_note, public.sa_my_name(), now())
  on conflict (attend_date, student_id) do update set
    status = excluded.status, manual = true, note = excluded.note,
    edited_by_name = excluded.edited_by_name, edited_at = excluded.edited_at;

  update public.official_attendance_days set
    updated_at = now(), updated_by = auth.uid(), updated_by_name = public.sa_my_name()
  where attend_date = p_date;

  perform public.sa_recount_day(p_date);
end;
$$;

grant execute on function public.sa_override_mark(date, jsonb, text, text) to authenticated;
