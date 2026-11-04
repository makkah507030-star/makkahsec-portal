-- =====================================================================
-- الثقافة المؤسسية (6 من 7): من أنجز كل عمل، وسجل الإجراءات والرسائل، وصفة الموظف.
-- • created_by في السجلات (ويبقى الاسم للسجلات القديمة) لينسب كل عمل لصاحبه من الفريق.
-- • cult_messages: كل رسالة يرسلها الفريق (القيم، مزايا، رفاه، الصحة التنظيمية، التواصل الملهم، الابتكار)،
--   ببرنامجها ونشاط الخطة المرتبط بها، وcult_send ترسلها إشعارًا وتسجّلها معًا.
-- • cult_me: ومعها هل هو سفير الثقافة بالتعيين (لمساحة السفير)، وcult_staff: صفة الموظف.
-- يُنفَّذ بعد cult_1..5.sql، وتكرار التنفيذ آمن.
-- =====================================================================
alter table public.cult_activities add column if not exists updated_by uuid default auth.uid();
alter table public.cult_meetings add column if not exists created_by uuid default auth.uid();
alter table public.cult_occasions add column if not exists created_by uuid default auth.uid();
alter table public.cult_onboard add column if not exists created_by uuid default auth.uid();
alter table public.cult_ideas add column if not exists reviewed_by uuid;
-- من حدّث النشاط آخر مرة يُسجَّل تلقائيًا
create or replace function public.cult_touch() returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists cult_act_touch on public.cult_activities;
create trigger cult_act_touch before insert or update on public.cult_activities for each row execute function public.cult_touch();

create table if not exists public.cult_messages (
  id uuid primary key default gen_random_uuid(),
  program text not null, kind text not null default 'general', title text not null, body text,
  activity_id uuid references public.cult_activities(id) on delete set null,
  recipients int not null default 0, notification_id uuid,
  sent_by uuid default auth.uid(), sent_by_name text, sent_at timestamptz not null default now()
);
alter table public.cult_messages enable row level security;
drop policy if exists cult_msg_read on public.cult_messages;
create policy cult_msg_read on public.cult_messages for select to authenticated using (public.cult_member());
drop policy if exists cult_msg_del on public.cult_messages;
create policy cult_msg_del on public.cult_messages for delete to authenticated using (public.cult_amb());
grant select, delete on public.cult_messages to authenticated;

-- إرسال رسالة لكل الموظفين (أو لأشخاص بأعيانهم) وتسجيلها في برنامجها؛ لسفير الثقافة
create or replace function public.cult_send(p_program text, p_kind text, p_title text, p_body text,
  p_activity uuid default null, p_user_ids uuid[] default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare ids uuid[]; nid uuid;
begin
  if not public.cult_amb() then raise exception 'إرسال رسائل الثقافة المؤسسية لسفير الثقافة'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'اكتب عنوان الرسالة'; end if;
  ids := coalesce(p_user_ids, (select array_agg(id) from users where is_active and role::text in ('teacher', 'admin')));
  nid := public.send_notification(trim(p_title), nullif(trim(coalesce(p_body, '')), ''), 'general', null, null, ids, null, null, true);
  insert into cult_messages (program, kind, title, body, activity_id, recipients, notification_id, sent_by, sent_by_name)
  values (p_program, coalesce(p_kind, 'general'), trim(p_title), nullif(trim(coalesce(p_body, '')), ''), p_activity,
          coalesce(cardinality(ids), 0), nid, auth.uid(), (select full_name from users where id = auth.uid()));
  -- نشاط الخطة المرتبط يصير «قيد التنفيذ» إن لم يبدأ بعد
  if p_activity is not null then
    update cult_activities set status = 'doing' where id = p_activity and status = 'todo';
  end if;
  return nid;
end $$;
revoke all on function public.cult_send(text, text, text, text, uuid, uuid[]) from public, anon;
grant execute on function public.cult_send(text, text, text, text, uuid, uuid[]) to authenticated;

-- صلاحيتي، ومعها ambassador (سفير بالتعيين في الفريق) وteam (عضو في الفريق بنفسه)
create or replace function public.cult_me() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('all', public.cult_all(), 'amb', public.cult_amb(), 'member', public.cult_member(), 'staff', public.cult_staff_user(),
    'ambassador', exists (select 1 from cult_team where user_id = auth.uid() and role = 'ambassador'),
    'team', exists (select 1 from cult_team where user_id = auth.uid()));
$$;

-- الموظفون بجوالاتهم وصفاتهم: تخصص المعلم، وأدوار الإداري
drop function if exists public.cult_staff();
create function public.cult_staff() returns table (id uuid, full_name text, mobile text, spec text, roles text[])
language sql stable security definer set search_path = public as $$
  select u.id, u.full_name,
         (select t.mobile from teachers t where t.user_id = u.id and coalesce(t.mobile, '') <> '' limit 1),
         (select t.specialization from teachers t where t.user_id = u.id and coalesce(t.specialization, '') <> '' limit 1),
         (select array_agg(r.role_type::text) from admin_roles r where r.user_id = u.id)
    from users u
   where public.cult_member() and u.is_active and u.role::text in ('teacher', 'admin') and u.full_name is not null
   order by u.full_name;
$$;
revoke all on function public.cult_staff() from public, anon;
grant execute on function public.cult_staff() to authenticated;
-- نهاية الجزء 6
