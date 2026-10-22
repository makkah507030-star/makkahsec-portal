-- =====================================================================
-- التعاميم (الجزء 2 من 3): الإرسال، والاطلاع، والتذكير. يُشغَّل بعد الجزء 1. تكرار التنفيذ آمن.
-- • الإرسال: يُحدَّد المستفيدون (المنسوبون كلهم أو المعلمون أو الإداريون، وأدوار بعينها، وأشخاص،
--   وأولياء أمور الكل أو صفوف أو فصول)، ويصل كلَّ جديدٍ منهم إشعار على الجرس والجوال.
-- • الاطلاع: يُسجَّل وقت الفتح، ووقت الضغط على «اطلعت» إن كان التعميم يتطلب الإقرار.
-- • التذكير: لمن لم يطّلع بعد، ويُسجَّل عدده ووقته.
-- =====================================================================

-- إشعار لمجموعة مستخدمين برابط التعميم (آلي)
create or replace function public.circ_notify(p_id uuid, p_title text, p_uids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare c circulars; nid uuid;
begin
  if coalesce(array_length(p_uids, 1), 0) = 0 then return; end if;
  select * into c from circulars where id = p_id;
  insert into notifications (title, body, kind, link, is_auto, created_by, sender_name)
  values (p_title, left(coalesce(nullif(trim(c.body), ''), c.subject), 160), 'general', '/circulars/' || p_id, true, auth.uid(),
          (select full_name from users where id = auth.uid()))
  returning id into nid;
  insert into notification_recipients (notification_id, user_id) select nid, unnest(p_uids) on conflict do nothing;
  begin perform public.push_notification(nid); exception when others then null; end;
end $$;

create or replace function public.circular_send(p_id uuid, p_staff text, p_roles text[], p_users uuid[],
  p_guardians text, p_grades int[], p_classes int[]) returns int
language plpgsql security definer set search_path = public as $$
declare v_new uuid[]; c circulars;
begin
  if not public.circ_manager() then raise exception 'غير مصرّح'; end if;
  select * into c from circulars where id = p_id;
  if c.id is null then raise exception 'التعميم غير موجود'; end if;
  with t as (
    select u.id, case when u.role::text = 'guardian' then 'guardian' else 'staff' end kind, u.full_name
      from users u
     where u.is_active and u.id <> auth.uid() and (
           (p_staff = 'all' and u.role::text in ('teacher', 'admin'))
        or (p_staff = 'teachers' and u.role::text = 'teacher')
        or (p_staff = 'admins' and u.role::text = 'admin')
        or u.id = any(coalesce(p_users, '{}'))
        or exists (select 1 from admin_roles a where a.user_id = u.id and a.role_type::text = any(coalesce(p_roles, '{}')))
        or (p_guardians in ('all', 'grades') and u.role::text = 'guardian' and exists (
              select 1 from guardians g join guardian_student gs on gs.guardian_id = g.id
                join v_active_students v on v.student_id = gs.student_id
               where g.user_id = u.id and (p_guardians = 'all' or v.grade = any(coalesce(p_grades, '{}')))
                 and (coalesce(array_length(p_classes, 1), 0) = 0 or v.class_no = any(p_classes))))))
  , ins as (
    insert into circular_recipients (circular_id, user_id, kind, name)
    select p_id, id, kind, full_name from t on conflict do nothing returning user_id)
  select array_agg(user_id) into v_new from ins;
  update circulars set sent_at = coalesce(sent_at, now()) where id = p_id;
  perform public.circ_notify(p_id, case c.priority when 'urgent' then 'تعميم عاجل: ' else 'تعميم: ' end || c.subject, v_new);
  return coalesce(array_length(v_new, 1), 0);
end $$;

-- فتح التعميم أو الإقرار بالاطلاع عليه (للمستفيد نفسه)
create or replace function public.circular_mark(p_id uuid, p_ack boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update circular_recipients
     set read_at = coalesce(read_at, now()), ack_at = case when p_ack then coalesce(ack_at, now()) else ack_at end
   where circular_id = p_id and user_id = auth.uid();
end $$;

-- تذكير من لم يطّلع (لم يقرّ إن تطلّب التعميم الإقرار، أو لم يفتحه)
create or replace function public.circular_remind(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare c circulars; v_ids uuid[];
begin
  if not public.circ_manager() then raise exception 'غير مصرّح'; end if;
  select * into c from circulars where id = p_id;
  if c.closed_at is not null then raise exception 'أُغلقت متابعة هذا التعميم'; end if;
  with u as (
    update circular_recipients set reminded_at = now(), remind_count = remind_count + 1
     where circular_id = p_id and (case when c.needs_ack then ack_at is null else read_at is null end)
    returning user_id)
  select array_agg(user_id) into v_ids from u;
  perform public.circ_notify(p_id, 'تذكير: تعميم بانتظار اطلاعك — ' || c.subject, v_ids);
  return coalesce(array_length(v_ids, 1), 0);
end $$;

revoke all on function public.circ_notify(uuid, text, uuid[]) from public, anon, authenticated;
revoke all on function public.circular_send(uuid, text, text[], uuid[], text, int[], int[]),
  public.circular_mark(uuid, boolean), public.circular_remind(uuid) from public, anon;
grant execute on function public.circular_send(uuid, text, text[], uuid[], text, int[], int[]),
  public.circular_mark(uuid, boolean), public.circular_remind(uuid) to authenticated;
-- نهاية الجزء 2
