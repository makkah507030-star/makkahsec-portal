-- =====================================================================
-- الطلاب المنقطعون (الجزء 2 من 2): البلاغ، وطي القيد أو رده، والإعادة
-- يُنفَّذ بعد الجزء 1 في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

-- بلاغ المعلم (أو الوكيل) عن طالب منقطع
create or replace function public.dropout_report(p_student uuid, p_reason text, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_class uuid;
begin
  select e.class_id into v_class from public.student_enrollment e
  where e.student_id = p_student and e.status = 'active' and e.academic_year = public.active_year() limit 1;
  if v_class is null then raise exception 'الطالب غير مسجّل في فصل هذا العام'; end if;
  if not (public.dr_can_manage() or exists (
    select 1 from public.schedule s join public.teachers t on t.id = s.teacher_id
    where t.user_id = auth.uid() and s.class_id = v_class)) then
    raise exception 'الطالب ليس من فصولك';
  end if;
  if exists (select 1 from public.student_dropouts where student_id = p_student and status in ('reported', 'withdrawn')) then
    raise exception 'سبق الإبلاغ عن هذا الطالب وهو قيد الإجراء';
  end if;
  insert into public.student_dropouts (student_id, student_name, national_id, class_id, class_no, grade,
                                       reason, note, absent_days, reported_by_name)
  select s.id, s.full_name, s.national_id, c.id, c.class_no, c.grade, p_reason, nullif(trim(p_note), ''),
         public.dr_streak(s.id), (select coalesce(full_name, username) from public.users where id = auth.uid())
  from public.students s, public.classes c where s.id = p_student and c.id = v_class
  returning id into v_id;
  return v_id;
end $$;

-- الوكيل: withdraw = طي القيد وإلغاء التفعيل من السجلات، dismiss = رد البلاغ (الطالب منتظم)
create or replace function public.dropout_decide(p_id uuid, p_action text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare d public.student_dropouts; v_enr uuid; v_user boolean; v_name text;
begin
  if not public.dr_can_manage() then raise exception 'للمدير ووكيل شؤون الطلاب فقط'; end if;
  select * into d from public.student_dropouts where id = p_id and status = 'reported' for update;
  if not found then raise exception 'البلاغ غير موجود أو سبق إجراؤه'; end if;
  v_name := (select coalesce(full_name, username) from public.users where id = auth.uid());
  if p_action = 'withdraw' then
    update public.student_enrollment set status = 'withdrawn'
    where student_id = d.student_id and status = 'active' and academic_year = public.active_year()
    returning id into v_enr;
    select u.is_active into v_user from public.students s join public.users u on u.id = s.user_id
    where s.id = d.student_id;
    update public.students set is_active = false where id = d.student_id;
    update public.users set is_active = false
    where id = (select user_id from public.students where id = d.student_id);
    update public.student_dropouts set status = 'withdrawn', enrollment_id = v_enr, user_was_active = v_user,
      decided_by_name = v_name, decided_at = now(), decision_note = nullif(trim(p_note), '') where id = p_id;
  elsif p_action = 'dismiss' then
    update public.student_dropouts set status = 'dismissed',
      decided_by_name = v_name, decided_at = now(), decision_note = nullif(trim(p_note), '') where id = p_id;
  else
    raise exception 'إجراء غير معروف';
  end if;
end $$;

-- إعادة الطالب للدراسة: يعود تسجيله وحسابه كما كانا قبل طي القيد
create or replace function public.dropout_return(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare d public.student_dropouts;
begin
  if not public.dr_can_manage() then raise exception 'للمدير ووكيل شؤون الطلاب فقط'; end if;
  select * into d from public.student_dropouts where id = p_id and status = 'withdrawn' for update;
  if not found then raise exception 'الطالب ليس في قائمة المنقطعين'; end if;
  update public.student_enrollment set status = 'active' where id = d.enrollment_id and status = 'withdrawn';
  update public.students set is_active = true where id = d.student_id;
  if coalesce(d.user_was_active, true) then
    update public.users set is_active = true
    where id = (select user_id from public.students where id = d.student_id);
  end if;
  update public.student_dropouts set status = 'returned', returned_at = now(), return_note = nullif(trim(p_note), ''),
    returned_by_name = (select coalesce(full_name, username) from public.users where id = auth.uid())
  where id = p_id;
end $$;

revoke execute on function public.dropout_report(uuid, text, text) from public, anon;
revoke execute on function public.dropout_decide(uuid, text, text) from public, anon;
revoke execute on function public.dropout_return(uuid, text) from public, anon;
grant execute on function public.dropout_report(uuid, text, text) to authenticated;
grant execute on function public.dropout_decide(uuid, text, text) to authenticated;
grant execute on function public.dropout_return(uuid, text) to authenticated;
-- نهاية الجزء 2
