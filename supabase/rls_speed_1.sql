-- تسريع قواعد الصلاحية (1 من 2): دوال تُحسب مرة واحدة للطلب، وجدول حضور الحصص.
-- كانت القواعد تستدعي is_admin() و owns_schedule() و is_guardian_of() لكل سطر، وكشف اليوم
-- آلاف الأسطر، فبلغ متوسط الاستعلام نحو ثانية وبعضه 4 ثوانٍ («الاتصال أبطأ من المعتاد»).
-- الصلاحيات نفسها دون تغيير: (select f()) يُحسب مرة، و«ضمن قائمة» بدل دالة لكل سطر.

-- طلاب ولي الأمر الحالي
create or replace function public.my_guardian_student_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select student_id from public.guardian_student where guardian_id = public.current_guardian_id();
$$;
-- حصص المعلم الحالي (مثل owns_schedule)
create or replace function public.my_schedule_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.schedule where teacher_id = public.current_teacher_id();
$$;
-- طلاب المعلم الحالي (مثل teaches_student)
create or replace function public.my_taught_student_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct se.student_id
    from public.schedule sch
    join public.student_enrollment se on se.class_id = sch.class_id and se.academic_year = sch.academic_year
   where sch.teacher_id = public.current_teacher_id()
     and se.academic_year = public.active_year() and se.status = 'active';
$$;
revoke execute on function public.my_guardian_student_ids() from public, anon;
revoke execute on function public.my_schedule_ids() from public, anon;
revoke execute on function public.my_taught_student_ids() from public, anon;
grant execute on function public.my_guardian_student_ids() to authenticated;
grant execute on function public.my_schedule_ids() to authenticated;
grant execute on function public.my_taught_student_ids() to authenticated;

-- حضور الحصص (class_attendance): قواعد القراءة، وقاعدة الإدارة لأنها FOR ALL تشمل القراءة
drop policy if exists catt_admin_read on public.class_attendance;
create policy catt_admin_read on public.class_attendance for select to authenticated
  using ((select public.is_admin()));
drop policy if exists catt_admin_write on public.class_attendance;
create policy catt_admin_write on public.class_attendance for all to authenticated
  using ((select public.has_any_admin_role(array['principal', 'deputy', 'clerk']::public.admin_role_type[])))
  with check ((select public.has_any_admin_role(array['principal', 'deputy', 'clerk']::public.admin_role_type[])));
drop policy if exists catt_guardian_read on public.class_attendance;
create policy catt_guardian_read on public.class_attendance for select to authenticated
  using (student_id in (select public.my_guardian_student_ids()));
drop policy if exists catt_self_read on public.class_attendance;
create policy catt_self_read on public.class_attendance for select to authenticated
  using (student_id = (select public.current_student_id()));
drop policy if exists catt_teacher_read on public.class_attendance;
create policy catt_teacher_read on public.class_attendance for select to authenticated
  using (schedule_id in (select public.my_schedule_ids()));
-- نهاية الجزء 1
