-- =====================================================================
-- مركز التحصيل (الجزء 3 من 3): اطلاع المعلم ورده بالأسباب والخطة، ومراجعة الموجه ورفعه
-- للوكيل مع إرسال الخطة لأولياء أمور المتعثرين، واعتماد الوكيل. بعد ach_forms_2.sql.
-- =====================================================================

create or replace function public.ach_seen(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update ach_forms set seen_at = now(), log = log || public.ach_ev('اطّلع المعلم')
  where id = p_id and teacher_user = auth.uid() and seen_at is null and status in ('sent', 'returned');
$$;

-- رد المعلم: الأسباب، والخطة لكل فصل { actions, from, to, followup, students }
create or replace function public.ach_reply(p_id uuid, p_reasons jsonb, p_plans jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare f ach_forms;
begin
  select * into f from ach_forms where id = p_id;
  if f.id is null or f.teacher_user is distinct from auth.uid() then raise exception 'غير مصرّح'; end if;
  if f.status not in ('sent', 'returned') then raise exception 'النموذج ليس بانتظار ردك'; end if;
  update ach_forms set reasons = p_reasons, plans = p_plans, status = 'replied', replied_at = now(), updated_at = now(),
    log = log || public.ach_ev('ردّ المعلم بالأسباب والخطة') where id = p_id;
  perform public.send_notification('ردّ ' || coalesce(f.teacher_name, 'المعلم') || ' على نموذج ملاحظة التحصيل',
    'المادة: ' || f.subject || '. راجع الأسباب والخطة العلاجية ثم ارفعها للوكيل.', 'general', '/ach-forms/' || p_id,
    null, public.ach_role_users(array['counselor_' || f.grade]), null, null, true);
end $$;

-- مراجعة الموجه: اعتماد ورفع للوكيل (وتصل الخطة أولياء أمور المتعثرين) أو إعادة للمعلم
create or replace function public.ach_review(p_id uuid, p_ok boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare f ach_forms; c jsonb; ids uuid[]; uids uuid[]; n int := 0;
begin
  select * into f from ach_forms where id = p_id;
  if f.id is null or not public.ach_can_send(f.grade) or f.status <> 'replied' then raise exception 'غير مصرّح'; end if;
  if not p_ok then
    if coalesce(trim(p_note), '') = '' then raise exception 'اكتب ما يلزم استكماله'; end if;
    update ach_forms set status = 'returned', review_note = trim(p_note), due_on = public.ach_add_days(current_date, 3), updated_at = now(),
      log = log || public.ach_ev('أُعيد للمعلم للاستكمال', trim(p_note)) where id = p_id;
    perform public.send_notification('أُعيد نموذج ملاحظة التحصيل للاستكمال: ' || f.subject, trim(p_note), 'general',
      '/ach-forms/' || p_id, null, array[f.teacher_user], null, null, true);
    return;
  end if;
  -- نسخة الخطة لأولياء أمور الطلاب المتعثرين في كل فصل (دون أسماء غيرهم)
  for c in select * from jsonb_array_elements(f.classes) loop
    if jsonb_typeof(f.plans->(c->>'class_id')->'students') = 'array' then
      select array_agg(v::uuid) into ids from jsonb_array_elements_text(f.plans->(c->>'class_id')->'students') v;
    else
      select array_agg((x->>'sid')::uuid) into ids from jsonb_array_elements(c->'students') x;
    end if;
    select array_agg(distinct g.user_id) into uids from guardian_student gs join guardians g on g.id = gs.guardian_id
      where gs.student_id = any(ids) and g.user_id is not null;
    if uids is not null then
      perform public.send_notification('خطة علاجية في مادة ' || f.subject,
        'يطبّق معلم المادة خطة علاجية لتحسين مستوى ابنكم في ' || f.subject || ': '
        || left(coalesce(f.plans->(c->>'class_id')->>'actions', ''), 400)
        || '. نأمل متابعته ودعمه في المنزل، وللاستفسار تواصلوا مع الموجه الطلابي.', 'general', '/', null, uids, null, null, true);
      n := n + array_length(uids, 1);
    end if;
  end loop;
  update ach_forms set status = 'forwarded', review_note = nullif(trim(p_note), ''), forwarded_at = now(), forwarded_by_name = public.ach_me(),
    guardians_notified = n, updated_at = now(),
    log = log || public.ach_ev('اعتمده الموجه ورفعه للوكيل، ووصلت الخطة ' || n || ' من أولياء الأمور', nullif(trim(p_note), '')) where id = p_id;
  perform public.send_notification('نموذج ملاحظة تحصيل بانتظار اعتمادك: ' || f.subject, coalesce(f.teacher_name, '') || ' — ' || f.subject,
    'general', '/ach-forms/' || p_id, null, public.ach_role_users(array['deputy_academic']), null, null, true);
end $$;

-- قرار الوكيل: اعتماد، أو إعادة للمعلم بملاحظة
create or replace function public.ach_decide(p_id uuid, p_ok boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare f ach_forms;
begin
  select * into f from ach_forms where id = p_id;
  if f.id is null or not public.ach_can_decide() or f.status <> 'forwarded' then raise exception 'غير مصرّح'; end if;
  if not p_ok and coalesce(trim(p_note), '') = '' then raise exception 'اكتب ملاحظة الإعادة'; end if;
  update ach_forms set status = case when p_ok then 'approved' else 'returned' end, deputy_note = nullif(trim(p_note), ''),
    decided_at = now(), decided_by_name = public.ach_me(), updated_at = now(),
    due_on = case when p_ok then due_on else public.ach_add_days(current_date, 3) end,
    log = log || public.ach_ev(case when p_ok then 'اعتمده وكيل الشؤون التعليمية' else 'أعاده الوكيل للمعلم' end, nullif(trim(p_note), ''))
  where id = p_id;
  perform public.send_notification(case when p_ok then 'اعتُمدت خطتك العلاجية: ' else 'أُعيد نموذج ملاحظة التحصيل: ' end || f.subject,
    coalesce(nullif(trim(p_note), ''), 'اعتمد وكيل الشؤون التعليمية الخطة، ويتابع تنفيذها.'), 'general', '/ach-forms/' || p_id,
    null, array[f.teacher_user] || public.ach_role_users(array['counselor_' || f.grade]), null, null, true);
end $$;

revoke all on function public.ach_seen(uuid), public.ach_reply(uuid, jsonb, jsonb), public.ach_review(uuid, boolean, text),
  public.ach_decide(uuid, boolean, text) from public, anon;
grant execute on function public.ach_seen(uuid), public.ach_reply(uuid, jsonb, jsonb), public.ach_review(uuid, boolean, text),
  public.ach_decide(uuid, boolean, text) to authenticated;

-- نهاية الجزء 3
