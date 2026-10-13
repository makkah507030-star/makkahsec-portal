-- =====================================================================
-- إقرار الطالب إلكترونيًا بتدوين المخالفة (الخطوة الثانية قبل الإحالة)
-- • student_actions.student_ack_at: وقت إقرار الطالب.
-- • notify_student_record: المعلم يُشعر الطالب بالتدوين ليقرّ به.
-- • my_pending_records: ما ينتظر إقرار الطالب الحالي.
-- • ack_student_record: الطالب يقرّ بالاطلاع.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
alter table public.student_actions add column if not exists student_ack_at timestamptz;

create or replace function public.notify_student_record(p_action uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare a record; v_user uuid; v_tname text;
begin
  select * into a from student_actions where id = p_action and teacher_id = auth.uid() and action = 'record';
  if a.id is null then raise exception 'الإجراء غير موجود'; end if;
  select user_id into v_user from students where id = a.student_id;
  if v_user is null then return null; end if;
  select full_name into v_tname from users where id = auth.uid();
  return public.send_notification(
    'ملاحظة سلوكية تنتظر إقرارك',
    'دوّن ' || coalesce(v_tname, 'المعلم') || ' ملاحظة: ' || coalesce(a.violation_text, a.detail, '') ||
    ' — افتح البوابة وأقرّ بالاطلاع.', 'general', '/', null, array[v_user], null, null, true);
end $$;

create or replace function public.my_pending_records()
returns table (id uuid, violation_text text, action_date date, teacher_name text)
language sql stable security definer set search_path = public as $$
  select a.id, coalesce(a.violation_text, a.detail), a.action_date, u.full_name
    from student_actions a
    join students s on s.id = a.student_id and s.user_id = auth.uid()
    left join users u on u.id = a.teacher_id
   where a.action = 'record' and a.student_ack_at is null
   order by a.created_at;
$$;

create or replace function public.ack_student_record(p_action uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update student_actions a set student_ack_at = now()
    from students s
   where a.id = p_action and s.id = a.student_id and s.user_id = auth.uid()
     and a.action = 'record' and a.student_ack_at is null;
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke execute on function public.notify_student_record(uuid) from public, anon;
revoke execute on function public.my_pending_records() from public, anon;
revoke execute on function public.ack_student_record(uuid) from public, anon;
grant execute on function public.notify_student_record(uuid) to authenticated;
grant execute on function public.my_pending_records() to authenticated;
grant execute on function public.ack_student_record(uuid) to authenticated;
-- نهاية الجزء 1
