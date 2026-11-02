-- النشرات والاستبانات (2 من 2): الإرسال والإشعار، والاطلاع، والإجابة، والتذكير. يُنفَّذ بعد الجزء 1. تكرار التنفيذ آمن.

-- إشعار بالجرس والجوال برابط النشرة (/o/المعرّف)
create or replace function public.outreach_notify(p_id uuid, p_title text, p_uids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare i outreach_items; nid uuid;
begin
  if coalesce(array_length(p_uids, 1), 0) = 0 then return; end if;
  select * into i from outreach_items where id = p_id;
  insert into notifications (title, body, kind, link, is_auto, created_by, sender_name)
  values (p_title, left(coalesce(nullif(trim(i.body), ''), i.title), 160), 'general', '/o/' || p_id, true, auth.uid(), i.created_by_name)
  returning id into nid;
  insert into notification_recipients (notification_id, user_id) select nid, unnest(p_uids) on conflict do nothing;
  begin perform public.push_notification(nid); exception when others then null; end;
end $$;

-- الإرسال: الطلاب (الكل أو صفوف وفصول أو طلاب بأعينهم)، وأولياء أمورهم، والمنسوبون. يُضاف الجديد فقط
create or replace function public.outreach_send(p_id uuid, p_students text, p_grades int[], p_classes int[], p_student_ids uuid[],
  p_guardians text, p_staff text, p_roles text[]) returns int
language plpgsql security definer set search_path = public as $$
declare i outreach_items; v_new uuid[]; nc int := coalesce(array_length(p_classes, 1), 0);
begin
  select * into i from outreach_items where id = p_id;
  if i.id is null or i.created_by <> auth.uid() then raise exception 'غير مصرّح'; end if;
  if i.kind = 'survey' and jsonb_array_length(i.questions) = 0 then raise exception 'أضف أسئلة الاستبانة أولًا'; end if;
  with t as (
    select u.id, 'student' kind, v.grade, v.class_no from users u join students s on s.user_id = u.id
      join v_active_students v on v.student_id = s.id
     where u.is_active and (p_students = 'all' or s.id = any(coalesce(p_student_ids, '{}'))
        or (p_students = 'grades' and v.grade = any(coalesce(p_grades, '{}')) and (nc = 0 or v.class_no = any(p_classes))))
    union
    select distinct on (u.id) u.id, 'guardian', v.grade, v.class_no from users u join guardians g on g.user_id = u.id
      join guardian_student gs on gs.guardian_id = g.id join v_active_students v on v.student_id = gs.student_id
     where u.is_active and (p_guardians = 'all'
        or (p_guardians = 'grades' and v.grade = any(coalesce(p_grades, '{}')) and (nc = 0 or v.class_no = any(p_classes))))
    union
    select u.id, 'staff', null::int, null::int from users u
     where u.is_active and u.id <> auth.uid() and ((p_staff = 'all' and u.role::text in ('teacher', 'admin'))
        or (p_staff = 'teachers' and u.role::text = 'teacher') or (p_staff = 'admins' and u.role::text = 'admin')
        or exists (select 1 from admin_roles a where a.user_id = u.id and a.role_type::text = any(coalesce(p_roles, '{}'))))
  ), ins as (
    insert into outreach_recipients (item_id, user_id, kind, grade, class_no)
    select distinct on (id) p_id, id, kind, grade, class_no from t on conflict do nothing returning user_id)
  select array_agg(user_id) into v_new from ins;
  update outreach_items set sent_at = coalesce(sent_at, now()), updated_at = now() where id = p_id;
  perform public.outreach_notify(p_id, case i.kind when 'survey' then 'استبانة: ' else 'نشرة توعوية: ' end || i.title, v_new);
  return coalesce(array_length(v_new, 1), 0);
end $$;

-- فتح النشرة أو «اطلعت» (للمستلم نفسه)
create or replace function public.outreach_mark(p_id uuid, p_ack boolean) returns void
language sql security definer set search_path = public as $$
  update outreach_recipients set read_at = coalesce(read_at, now()),
         ack_at = case when p_ack then coalesce(ack_at, now()) else ack_at end
   where item_id = p_id and user_id = auth.uid();
$$;

-- الإجابة مرة واحدة داخل الموعد؛ ولا يُحفظ صاحبها في الاستبانة دون اسم
create or replace function public.outreach_answer(p_id uuid, p_answers jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare i outreach_items; r outreach_recipients;
begin
  select * into i from outreach_items where id = p_id;
  select * into r from outreach_recipients where item_id = p_id and user_id = auth.uid();
  if i.id is null or i.kind <> 'survey' or i.sent_at is null or r.user_id is null then raise exception 'الاستبانة غير متاحة لك'; end if;
  if i.closed_at is not null or (i.closes_at is not null and now() >= i.closes_at) then raise exception 'أُغلقت الاستبانة'; end if;
  if r.answered_at is not null then raise exception 'أجبت عن هذه الاستبانة من قبل'; end if;
  insert into outreach_answers (item_id, user_id, kind, grade, class_no, answers)
  values (p_id, case when i.anonymous then null else auth.uid() end, r.kind, r.grade, r.class_no, coalesce(p_answers, '{}'));
  update outreach_recipients set answered_at = now(), read_at = coalesce(read_at, now()) where item_id = p_id and user_id = auth.uid();
end $$;

-- تذكير من لم يُجب (الاستبانة) أو لم يطّلع (النشرة)
create or replace function public.outreach_remind(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare i outreach_items; v uuid[];
begin
  select * into i from outreach_items where id = p_id;
  if i.id is null or i.created_by <> auth.uid() then raise exception 'غير مصرّح'; end if;
  with u as (update outreach_recipients set remind_count = remind_count + 1
              where item_id = p_id and case when i.kind = 'survey' then answered_at is null
                                            when i.needs_ack then ack_at is null else read_at is null end
             returning user_id)
  select array_agg(user_id) into v from u;
  perform public.outreach_notify(p_id, 'تذكير: ' || i.title, v);
  return coalesce(array_length(v, 1), 0);
end $$;

revoke execute on function public.outreach_notify(uuid, text, uuid[]) from public, anon, authenticated;
revoke execute on function public.outreach_send(uuid, text, int[], int[], uuid[], text, text, text[]) from public, anon;
revoke execute on function public.outreach_mark(uuid, boolean), public.outreach_answer(uuid, jsonb), public.outreach_remind(uuid) from public, anon;
grant execute on function public.outreach_send(uuid, text, int[], int[], uuid[], text, text, text[]) to authenticated;
grant execute on function public.outreach_mark(uuid, boolean), public.outreach_answer(uuid, jsonb), public.outreach_remind(uuid) to authenticated;
-- نهاية الجزء 2
