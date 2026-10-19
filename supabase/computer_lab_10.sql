-- =====================================================================
-- معمل الحاسب الآلي (10): الكتابة في سجل التطبيقات العملية. يُنفَّذ بعد الجزء 9.
-- درجة المنقول = نسبة اختبار الدرس × الدرجة العظمى، مقرّبة لأقرب نصف درجة.
-- =====================================================================

-- نقل حصة إلى السجل عمودًا جديدًا، أو تحديث عمودها (يُكمل من رُصد بعد النقل، ولا يمسّ المعدَّل يدويًا)
create or replace function public.lab_work_from_session(p_session uuid, p_title text default null, p_max numeric default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare s public.lab_sessions; v_tid uuid := public.current_teacher_id(); v_work public.lab_works;
begin
  select * into s from public.lab_sessions where id = p_session and created_by = auth.uid();
  if s.id is null or v_tid is null then raise exception 'الحصة غير موجودة أو ليست من حصصك'; end if;
  select * into v_work from public.lab_works where teacher_id = v_tid and session_id = s.id;
  if v_work.id is null then
    insert into public.lab_works (lab_id, class_id, teacher_id, term_key, title, max_mark, session_id, work_date)
    values (s.lab_id, s.class_id, v_tid, public.lab_term_key(), coalesce(nullif(trim(p_title), ''), s.lesson_title),
            coalesce(p_max, 10), s.id, s.created_at::date)
    returning * into v_work;
  end if;
  insert into public.lab_work_marks (work_id, student_id, mark)
  select v_work.id, r.student_id, round(r.quiz * v_work.max_mark / 100 * 2) / 2
    from public.lab_results r where r.session_id = s.id and r.quiz is not null
  on conflict (work_id, student_id) do update set mark = excluded.mark, updated_at = now()
   where not lab_work_marks.manual;
  return v_work.id;
end $$;

-- عمل يدوي (تطبيق نُفّذ خارج ملف المعمل)
create or replace function public.lab_work_add(p_lab smallint, p_class uuid, p_title text, p_max numeric, p_date date default current_date)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if public.current_teacher_id() is null or not public.lab_can_book() then raise exception 'السجل لمعلمي الحاسب المخوّلين'; end if;
  insert into public.lab_works (lab_id, class_id, teacher_id, term_key, title, max_mark, work_date)
  values (p_lab, p_class, public.current_teacher_id(), public.lab_term_key(), trim(p_title), p_max, coalesce(p_date, current_date))
  returning id into v_id;
  return v_id;
end $$;

-- تعديل اسم العمل ودرجته العظمى (الدرجات المنقولة تُعاد بالنسبة نفسها)
create or replace function public.lab_work_update(p_work uuid, p_title text, p_max numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_old numeric;
begin
  if not public.lab_work_mine(p_work) then raise exception 'غير مخوّل'; end if;
  select max_mark into v_old from public.lab_works where id = p_work;
  update public.lab_works set title = trim(p_title), max_mark = p_max where id = p_work;
  if p_max <> v_old then
    update public.lab_work_marks set mark = least(round(mark * p_max / v_old * 2) / 2, p_max), updated_at = now() where work_id = p_work;
  end if;
end $$;

create or replace function public.lab_work_delete(p_work uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.lab_work_mine(p_work) then raise exception 'غير مخوّل'; end if;
  delete from public.lab_works where id = p_work;
end $$;

-- درجة طالب في عمل (فارغة = حذف)
create or replace function public.lab_mark_set(p_work uuid, p_student uuid, p_mark numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.lab_work_mine(p_work) then raise exception 'غير مخوّل'; end if;
  if p_mark is null then delete from public.lab_work_marks where work_id = p_work and student_id = p_student; return; end if;
  if p_mark < 0 or p_mark > (select max_mark from public.lab_works where id = p_work) then raise exception 'الدرجة خارج الحد'; end if;
  insert into public.lab_work_marks (work_id, student_id, mark, manual) values (p_work, p_student, p_mark, true)
  on conflict (work_id, student_id) do update set mark = excluded.mark, manual = true, updated_at = now();
end $$;

revoke execute on function public.lab_work_from_session(uuid, text, numeric), public.lab_work_add(smallint, uuid, text, numeric, date),
  public.lab_work_update(uuid, text, numeric), public.lab_work_delete(uuid), public.lab_mark_set(uuid, uuid, numeric) from public, anon;
grant execute on function public.lab_work_from_session(uuid, text, numeric), public.lab_work_add(smallint, uuid, text, numeric, date),
  public.lab_work_update(uuid, text, numeric), public.lab_work_delete(uuid), public.lab_mark_set(uuid, uuid, numeric) to authenticated;
-- نهاية الجزء 10
