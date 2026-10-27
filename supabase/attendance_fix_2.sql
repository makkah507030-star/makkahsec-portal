-- =====================================================================
-- مركز تصحيح الحضور — الجزء 2 من 2: دوال التعديل (بعد الجزء 1).
-- كلها لمن يملك «تصحيح الحضور»، والسبب إلزامي، ويُسجَّل كل تعديل في attendance_corrections.
-- تكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.att_fix_log(p_date date, p_student uuid, p_kind text, p_period int,
                                              p_old text, p_new text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('attendance_fix') then raise exception 'غير مصرّح: تصحيح الحضور'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'اكتب سبب التعديل'; end if;
  if p_date > public.today_ksa() then raise exception 'لا يُعدَّل يوم لم يأتِ بعد'; end if;
  insert into public.attendance_corrections (attend_date, student_id, kind, period_no, old_value, new_value, reason, by_name)
  values (p_date, p_student, p_kind, p_period, p_old, p_new, trim(p_reason), public.sa_my_name());
end $$;

-- حالة حصة: تسجيل (ولو لم تُرصد) أو تغيير، بلا إشعار لولي الأمر
create or replace function public.att_fix_period(p_date date, p_student uuid, p_schedule uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text; v_no int;
begin
  if p_status not in ('present', 'absent', 'late', 'excused') then raise exception 'حالة غير صالحة'; end if;
  select status::text into v_old from public.class_attendance
   where student_id = p_student and schedule_id = p_schedule and attend_date = p_date;
  if v_old = p_status then return; end if;
  select period_no into v_no from public.schedule where id = p_schedule;
  perform public.att_fix_log(p_date, p_student, 'period', v_no, v_old, p_status, p_reason);
  perform set_config('app.att_fix', '1', true);
  insert into public.class_attendance (student_id, schedule_id, attend_date, status, recorded_by, academic_year)
  values (p_student, p_schedule, p_date, p_status::class_att_status, auth.uid(),
          coalesce((select value from public.settings where key = 'active_year'), ''))
  on conflict (student_id, schedule_id, attend_date) do update
    set status = excluded.status, updated_by = auth.uid(), updated_at = now();
  perform set_config('app.att_fix', '', true);
  -- الحصص صارت مرجع الحالة الرسمية: يُزال التصحيح اليدوي السابق إلا العذر
  delete from public.official_day_marks
   where attend_date = p_date and student_id = p_student and manual and status <> 'excused';
end $$;

-- التأخر الصباحي: waive إلغاؤه، late تسجيله بدقائق، auto العودة إلى البصمة
create or replace function public.att_fix_late(p_date date, p_student uuid, p_mode text, p_minutes int, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if p_mode not in ('waive', 'late', 'auto') then raise exception 'نوع غير صالح'; end if;
  select mode || coalesce(':' || minutes, '') into v_old from public.attendance_late_overrides
   where attend_date = p_date and student_id = p_student;
  perform public.att_fix_log(p_date, p_student, 'late', null, coalesce(v_old, 'auto'),
                             p_mode || case when p_mode = 'late' then ':' || coalesce(p_minutes, 1) else '' end, p_reason);
  if p_mode = 'auto' then
    delete from public.attendance_late_overrides where attend_date = p_date and student_id = p_student;
  else
    insert into public.attendance_late_overrides (attend_date, student_id, mode, minutes, reason, by_name)
    values (p_date, p_student, p_mode, case when p_mode = 'late' then greatest(coalesce(p_minutes, 1), 1) end,
            trim(p_reason), public.sa_my_name())
    on conflict (attend_date, student_id) do update
      set mode = excluded.mode, minutes = excluded.minutes, reason = excluded.reason,
          by_name = excluded.by_name, at = now();
  end if;
end $$;

-- الحالة الرسمية: excused غائب بعذر، auto العودة إلى المحسوب من الحصص (يوم معتمد)
create or replace function public.att_fix_official(p_date date, p_student uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text; s record;
begin
  if p_status not in ('excused', 'auto') then raise exception 'حالة غير صالحة'; end if;
  if not exists (select 1 from public.official_attendance_days where attend_date = p_date) then
    raise exception 'اعتمد الغياب الرسمي لهذا اليوم أولًا'; end if;
  select case when manual then status end into v_old from public.official_day_marks
   where attend_date = p_date and student_id = p_student;
  perform public.att_fix_log(p_date, p_student, 'official', null, coalesce(v_old, 'auto'), p_status, p_reason);
  if p_status = 'auto' then
    delete from public.official_day_marks where attend_date = p_date and student_id = p_student and manual;
  else
    select v.full_name, st.national_id, v.class_no, v.grade into s
      from public.v_active_students v join public.students st on st.id = v.student_id where v.student_id = p_student;
    insert into public.official_day_marks as m (attend_date, student_id, status, punched, full_name, national_id,
                                               class_no, grade, manual, note, edited_by_name, edited_at)
    values (p_date, p_student, 'excused',
            exists (select 1 from public.daily_attendance d where d.student_id = p_student and d.attend_date = p_date),
            s.full_name, s.national_id, s.class_no, s.grade, true, trim(p_reason), public.sa_my_name(), now())
    on conflict (attend_date, student_id) do update
      set status = 'excused', manual = true, note = excluded.note,
          edited_by_name = excluded.edited_by_name, edited_at = excluded.edited_at;
  end if;
  perform public.sa_recount_day(p_date);
end $$;

revoke execute on function public.att_fix_log(date, uuid, text, int, text, text, text) from public, anon, authenticated;
do $do$ declare f text; begin
  foreach f in array array['att_fix_period(date, uuid, uuid, text, text)', 'att_fix_late(date, uuid, text, int, text)',
                           'att_fix_official(date, uuid, text, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $do$;
-- نهاية الجزء 2
