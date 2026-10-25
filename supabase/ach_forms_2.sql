-- =====================================================================
-- مركز تحليل النتائج (الجزء 2 من 3): إنشاء المسودات آليًا، والإرسال للمعلم، والاستبعاد، والتذكير.
-- يُنفَّذ بعد ach_forms_1.sql. تكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.ach_me() returns text language sql stable security definer set search_path = public as $$
  select coalesce((select full_name from users where id = auth.uid()), '—');
$$;
create or replace function public.ach_ev(p_action text, p_note text default null) returns jsonb language sql stable as $$
  select jsonb_build_array(jsonb_build_object('at', now(), 'by', public.ach_me(), 'action', p_action, 'note', p_note));
$$;

-- المسودات من تحليل المركز (يكتبها موجه الصف والوكيل والمدير والدعم الفني): تُضاف الجديدة، وتُحدَّث لقطة المسودة، وتُحذف مسودة زال ضعفها.
-- ومعها التذكير الآلي لمن تجاوز المهلة (مرة كل يومين).
create or replace function public.ach_sync(p_year text, p_key text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; n_new int := 0; n_rem int := 0; f record; keep text[] := '{}'; v_ins boolean;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    continue when not public.ach_can_send((r->>'grade')::int);
    keep := keep || ((r->>'grade') || '|' || (r->>'subject') || '|' || (r->>'teacher_id'));
    insert into ach_forms (academic_year, report_key, grade, subject, teacher_id, teacher_user, teacher_name, classes, log)
    values (p_year, p_key, (r->>'grade')::int, r->>'subject', (r->>'teacher_id')::uuid, (r->>'teacher_user')::uuid,
            r->>'teacher_name', r->'classes', jsonb_build_array(jsonb_build_object('at', now(), 'by', 'البوابة', 'action', 'أُنشئ آليًا')))
    on conflict (academic_year, report_key, grade, subject, teacher_id) do update
      set classes = excluded.classes, teacher_name = excluded.teacher_name, teacher_user = excluded.teacher_user, updated_at = now()
      where ach_forms.status = 'draft'
    returning (xmax = 0) into v_ins;
    if v_ins then n_new := n_new + 1; end if;
    v_ins := null;
  end loop;
  delete from ach_forms where academic_year = p_year and report_key = p_key and status = 'draft' and public.ach_can_send(grade)
    and not ((grade::text || '|' || subject || '|' || teacher_id::text) = any(keep));

  for f in select * from ach_forms where status in ('sent', 'returned') and due_on < current_date and teacher_user is not null
             and (reminded_at is null or reminded_at < now() - interval '2 days') and public.ach_can_send(grade) loop
    perform public.send_notification('تذكير: نموذج ملاحظة التحصيل في ' || f.subject,
      'تجاوز النموذج مهلة الرد. أكمل أسباب الضعف والخطة العلاجية.', 'general', '/ach-forms/' || f.id, null, array[f.teacher_user], null, null, true);
    update ach_forms set reminded_at = now(), log = log || public.ach_ev('تذكير آلي بتجاوز المهلة') where id = f.id;
    n_rem := n_rem + 1;
  end loop;
  return jsonb_build_object('new', n_new, 'reminded', n_rem);
end $$;

-- الإرسال للمعلم بمهلة 5 أيام دراسية
create or replace function public.ach_send(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare f ach_forms;
begin
  select * into f from ach_forms where id = p_id;
  if f.id is null or not public.ach_can_send(f.grade) then raise exception 'غير مصرّح'; end if;
  if f.status not in ('draft', 'excluded') then raise exception 'أُرسل النموذج من قبل'; end if;
  if f.teacher_user is null then raise exception 'لا حساب للمعلم في البوابة'; end if;
  update ach_forms set status = 'sent', counselor_note = nullif(trim(p_note), ''), sent_at = now(), sent_by_name = public.ach_me(),
    due_on = public.ach_add_days(current_date, 5), exclude_reason = null, updated_at = now(),
    log = log || public.ach_ev('أُرسل للمعلم', nullif(trim(p_note), '')) where id = p_id;
  perform public.send_notification('نموذج ملاحظة التحصيل: ' || f.subject,
    'رصد مركز تحليل النتائج ضعفًا في نتائج فصولك. اطّلع على النموذج وأكمل أسباب الضعف والخطة العلاجية خلال 5 أيام دراسية.',
    'general', '/ach-forms/' || p_id, null, array[f.teacher_user], null, null, true);
end $$;

create or replace function public.ach_exclude(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare f ach_forms;
begin
  select * into f from ach_forms where id = p_id;
  if f.id is null or not public.ach_can_send(f.grade) then raise exception 'غير مصرّح'; end if;
  if f.status <> 'draft' then raise exception 'لا يُستبعد إلا قبل الإرسال'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'اكتب سبب الاستبعاد'; end if;
  update ach_forms set status = 'excluded', exclude_reason = trim(p_reason), updated_at = now(),
    log = log || public.ach_ev('استُبعد', trim(p_reason)) where id = p_id;
end $$;

create or replace function public.ach_remind(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare f ach_forms;
begin
  select * into f from ach_forms where id = p_id;
  if f.id is null or not public.ach_can_send(f.grade) or f.status not in ('sent', 'returned') then raise exception 'غير مصرّح'; end if;
  perform public.send_notification('تذكير: نموذج ملاحظة التحصيل في ' || f.subject, 'أكمل أسباب الضعف والخطة العلاجية.',
    'general', '/ach-forms/' || p_id, null, array[f.teacher_user], null, null, true);
  update ach_forms set reminded_at = now(), log = log || public.ach_ev('تذكير من ' || public.ach_me()) where id = p_id;
end $$;

revoke all on function public.ach_me(), public.ach_sync(text, text, jsonb), public.ach_send(uuid, text),
  public.ach_exclude(uuid, text), public.ach_remind(uuid) from public, anon;
grant execute on function public.ach_sync(text, text, jsonb), public.ach_send(uuid, text), public.ach_exclude(uuid, text),
  public.ach_remind(uuid) to authenticated;

-- نهاية الجزء 2
