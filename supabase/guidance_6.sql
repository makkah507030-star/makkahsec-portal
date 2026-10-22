-- =====================================================================
-- طلبات مقابلة الموجه الطلابي (الجزء 6): المقابلة عن بعد والمحادثة والرسائل الصوتية.
-- • الطلب حضوري (بموعد كما كان) أو عن بعد: سؤال أو استفسار بلا موعد.
-- • محادثة لكل طلب بين الموجه وصاحب الطلب: نص، ورسالة صوتية للموجه وولي الأمر (الطالب نصًا).
-- • التسجيلات في مخزن خاص guidance-voice في مجلد باسم الطلب، يسمعها طرفا المحادثة وحدهما.
-- يُشغَّل بعد guidance_4.sql. تكرار التنفيذ آمن.
-- =====================================================================

alter table public.guidance_requests add column if not exists mode text not null default 'inperson';
alter table public.guidance_requests drop constraint if exists guidance_requests_mode_check;
alter table public.guidance_requests add constraint guidance_requests_mode_check check (mode in ('inperson', 'remote'));
alter table public.guidance_requests drop constraint if exists guidance_requests_status_check;
alter table public.guidance_requests add constraint guidance_requests_status_check
  check (status in ('new', 'scheduled', 'replied', 'done', 'declined'));

create table if not exists public.guidance_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.guidance_requests(id) on delete cascade,
  sender uuid not null default auth.uid(),
  side text not null default 'requester' check (side in ('counselor', 'requester')),
  sender_name text,
  body text,
  audio_path text,
  audio_secs int,
  created_at timestamptz not null default now(),
  check (coalesce(trim(body), '') <> '' or audio_path is not null)
);
create index if not exists guidance_messages_req on public.guidance_messages (request_id, created_at);

-- طرف المستخدم في الطلب: counselor (موجه صفه أو الإدارة) أو requester (صاحبه)، وإلا null
create or replace function public.guidance_req_side(p_req text) returns text
language plpgsql stable security definer set search_path = public as $$
declare r guidance_requests;
begin
  select * into r from guidance_requests where id = p_req::uuid;
  if r.id is null then return null; end if;
  if public.guidance_can(r.grade) then return 'counselor'; end if;
  if r.requested_by = auth.uid() then return 'requester'; end if;
  return null;
exception when others then return null;
end $$;

create or replace function public.guidance_message_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare r guidance_requests; nid uuid; uids uuid[];
begin
  select * into r from guidance_requests where id = new.request_id;
  new.side := public.guidance_req_side(new.request_id::text);
  if new.side is null then raise exception 'غير مصرّح'; end if;
  if r.status in ('done', 'declined') then raise exception 'أُغلق هذا الطلب'; end if;
  if new.audio_path is not null and new.side = 'requester' and r.requester = 'student' then
    raise exception 'الرسائل الصوتية للموجه وولي الأمر'; end if;
  new.sender := auth.uid(); new.created_at := now();
  new.sender_name := (select full_name from users where id = auth.uid());
  if new.side = 'counselor' then
    if r.mode = 'remote' and r.status = 'new' then update guidance_requests set status = 'replied' where id = r.id; end if;
    uids := array[r.requested_by];
  else
    select array_agg(a.user_id) into uids from admin_roles a where a.role_type::text = 'counselor_' || r.grade;
  end if;
  if uids is not null then
    nid := public.send_notification(case new.side when 'counselor' then 'رسالة من الموجه الطلابي' else 'رسالة في طلب مقابلة' end,
      coalesce(left(nullif(trim(new.body), ''), 120), 'رسالة صوتية'), 'general',
      case new.side when 'counselor' then '/' else '/guidance?tab=requests&grade=' || r.grade end, null, uids, null, null, true);
    begin perform public.push_notification(nid); exception when others then null; end;
  end if;
  return new;
end $$;
drop trigger if exists guidance_message_trg on public.guidance_messages;
create trigger guidance_message_trg before insert on public.guidance_messages
  for each row execute function public.guidance_message_trg();

alter table public.guidance_messages enable row level security;
drop policy if exists "guidance messages read" on public.guidance_messages;
create policy "guidance messages read" on public.guidance_messages for select to authenticated
  using (public.guidance_req_side(request_id::text) is not null);
drop policy if exists "guidance messages insert" on public.guidance_messages;
create policy "guidance messages insert" on public.guidance_messages for insert to authenticated
  with check (public.guidance_req_side(request_id::text) is not null);
grant select, insert on public.guidance_messages to authenticated;
revoke all on function public.guidance_req_side(text) from public, anon;
grant execute on function public.guidance_req_side(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('guidance-voice', 'guidance-voice', false, 6291456) on conflict (id) do nothing;
drop policy if exists "guidance voice read" on storage.objects;
create policy "guidance voice read" on storage.objects for select to authenticated
  using (bucket_id = 'guidance-voice' and public.guidance_req_side((storage.foldername(name))[1]) is not null);
drop policy if exists "guidance voice add" on storage.objects;
create policy "guidance voice add" on storage.objects for insert to authenticated
  with check (bucket_id = 'guidance-voice' and public.guidance_req_side((storage.foldername(name))[1]) is not null);
-- نهاية الجزء 6
