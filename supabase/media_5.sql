-- =====================================================================
-- استوديو الوسائط (الجزء 5): التواصل مع المركز الإعلامي من كل الفئات.
-- • media_requests: طلب تغطية، أو اقتراح، أو مشاركة، أو غيرها، من الطالب وولي الأمر والمنسوب،
--   بموعد الفعالية ومكانها في طلب التغطية، وحالته (جديد، مقبول، منجز، معتذر).
-- • media_request_msgs: المحادثة داخل الطلب بين صاحبه والمركز.
-- • المركز: من يملك صلاحية «استوديو الوسائط» وقادة الفريق (media_4.sql)، ويصلهم إشعار بكل طلب
--   ورسالة، ويصل صاحب الطلب إشعار برد المركز وتغيير الحالة.
-- يُنفَّذ بعد media_4.sql في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.media_center() returns boolean
language sql stable security definer set search_path = public as $$
  select public.media_manager() or exists (select 1 from media_team_staff where user_id = auth.uid());
$$;

create table if not exists public.media_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('coverage', 'suggestion', 'share', 'other')),
  title text not null check (length(trim(title)) > 0),
  body text,
  event_at timestamptz, place text,              -- لطلب التغطية
  status text not null default 'new' check (status in ('new', 'accepted', 'done', 'declined')),
  created_by uuid not null default auth.uid(), created_by_name text, created_by_role text,
  created_at timestamptz not null default now(), updated_at timestamptz
);
create table if not exists public.media_request_msgs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.media_requests(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  by_user uuid not null default auth.uid(), by_name text,
  from_center boolean not null default false,
  at timestamptz not null default now()
);
create index if not exists media_request_msgs_req on public.media_request_msgs (request_id, at);

alter table public.media_requests enable row level security;
alter table public.media_request_msgs enable row level security;
drop policy if exists media_requests_read on public.media_requests;
create policy media_requests_read on public.media_requests for select to authenticated
  using (created_by = auth.uid() or public.media_center());
drop policy if exists media_requests_add on public.media_requests;
create policy media_requests_add on public.media_requests for insert to authenticated
  with check (created_by = auth.uid() and status = 'new');
drop policy if exists media_requests_status on public.media_requests;
create policy media_requests_status on public.media_requests for update to authenticated
  using (public.media_center()) with check (public.media_center());
drop policy if exists media_request_msgs_read on public.media_request_msgs;
create policy media_request_msgs_read on public.media_request_msgs for select to authenticated
  using (exists (select 1 from media_requests r where r.id = request_id and (r.created_by = auth.uid() or public.media_center())));
drop policy if exists media_request_msgs_add on public.media_request_msgs;
create policy media_request_msgs_add on public.media_request_msgs for insert to authenticated
  with check (by_user = auth.uid() and from_center = public.media_center() and exists (
    select 1 from media_requests r where r.id = request_id and (r.created_by = auth.uid() or public.media_center())));

-- الإشعارات: الطلب ورسائل صاحبه للمركز، ورد المركز وتغيير الحالة لصاحبه
create or replace function public.media_request_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare r media_requests; uids uuid[]; nid uuid; v_title text; v_body text; v_link text := '/media-contact';
begin
  if tg_table_name = 'media_requests' and tg_op = 'INSERT' then
    r := new; v_title := 'طلب جديد للمركز الإعلامي'; v_body := new.title || coalesce(' — ' || new.created_by_name, '');
  elsif tg_table_name = 'media_requests' then
    if new.status = old.status then return new; end if;
    r := new; uids := array[new.created_by]; v_title := 'تحديث طلبك للمركز الإعلامي';
    v_body := new.title || ': ' || case new.status when 'accepted' then 'قُبل' when 'done' then 'أُنجز' when 'declined' then 'اعتذر المركز' else 'جديد' end;
  else
    select * into r from media_requests where id = new.request_id;
    v_title := 'رسالة في طلب المركز الإعلامي'; v_body := r.title || ': ' || left(new.body, 120);
    if new.from_center then uids := array[r.created_by]; end if;
  end if;
  if uids is null then    -- إلى المركز: أصحاب صلاحية الاستوديو بأدوارهم، وقادة الفريق
    select array_agg(distinct x.uid) into uids from (
      select a.user_id uid from admin_roles a join role_permissions p on p.role_type::text = a.role_type::text and p.permission = 'media'
      union select user_id from media_team_staff) x
     join users u on u.id = x.uid and u.is_active where x.uid is distinct from auth.uid();
    v_link := '/media-contact?center=1';
  end if;
  if uids is not null and cardinality(uids) > 0 then
    nid := public.send_notification(v_title, v_body, 'general', v_link, null, uids, null, null, true);
    begin perform public.push_notification(nid); exception when others then null; end;
  end if;
  return new;
end $$;
drop trigger if exists media_request_notify on public.media_requests;
create trigger media_request_notify after insert or update of status on public.media_requests
  for each row execute function public.media_request_notify();
drop trigger if exists media_request_msg_notify on public.media_request_msgs;
create trigger media_request_msg_notify after insert on public.media_request_msgs
  for each row execute function public.media_request_notify();

revoke all on function public.media_center() from public, anon;
grant execute on function public.media_center() to authenticated;
select (select count(*) from public.media_requests) as "الطلبات";
-- نهاية الجزء 5
