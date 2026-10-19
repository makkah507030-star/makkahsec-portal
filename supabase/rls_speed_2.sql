-- تسريع قواعد الصلاحية (2 من 2): البصمة اليومية (daily_attendance) والطلاب (students).
-- يُشغَّل بعد الجزء 1. الصلاحيات نفسها دون تغيير.

drop policy if exists daily_admin_read on public.daily_attendance;
create policy daily_admin_read on public.daily_attendance for select to authenticated
  using ((select public.is_admin()));
drop policy if exists daily_admin_write on public.daily_attendance;
create policy daily_admin_write on public.daily_attendance for all to authenticated
  using ((select public.has_any_admin_role(array['principal', 'deputy', 'clerk']::public.admin_role_type[])))
  with check ((select public.has_any_admin_role(array['principal', 'deputy', 'clerk']::public.admin_role_type[])));
drop policy if exists daily_guardian_read on public.daily_attendance;
create policy daily_guardian_read on public.daily_attendance for select to authenticated
  using (student_id in (select public.my_guardian_student_ids()));
drop policy if exists daily_self_read on public.daily_attendance;
create policy daily_self_read on public.daily_attendance for select to authenticated
  using (student_id = (select public.current_student_id()));
drop policy if exists daily_teacher_read on public.daily_attendance;
create policy daily_teacher_read on public.daily_attendance for select to authenticated
  using (student_id in (select public.my_taught_student_ids()));

drop policy if exists students_admin_read on public.students;
create policy students_admin_read on public.students for select to authenticated
  using ((select public.is_admin()));
drop policy if exists students_admin_write on public.students;
create policy students_admin_write on public.students for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists students_guardian_read on public.students;
create policy students_guardian_read on public.students for select to authenticated
  using (id in (select public.my_guardian_student_ids()));
drop policy if exists students_self_read on public.students;
create policy students_self_read on public.students for select to authenticated
  using (id = (select public.current_student_id()));
drop policy if exists students_teacher_read on public.students;
create policy students_teacher_read on public.students for select to authenticated
  using (id in (select public.my_taught_student_ids()));

-- للتحقق: القواعد بعد التعديل
select tablename, policyname, cmd from pg_policies
 where tablename in ('class_attendance', 'daily_attendance', 'students') order by 1, 2;
-- نهاية الجزء 2
