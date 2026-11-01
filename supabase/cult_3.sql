-- =====================================================================
-- الثقافة المؤسسية (3): سجلات البرامج وإشعار الموظفين.
-- • التواصل الملهم: اللقاءات (رسمي، القائد الموجه، جلسة فنجان، غير رسمي، الموظف الضيف).
-- • نهتم بك: مناسبات الموظفين (تهنئة، تعزية…) وإرسال بطاقتها إشعارًا لصاحبها.
-- • حيّاك: تهيئة الموظف الجديد بقائمة مهامها. • الابتكار: أفكار الموظفين ومتابعتها وتكريمها.
-- يُنفَّذ بعد cult_2.sql، وتكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.cult_meetings (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('formal', 'guide', 'coffee', 'informal', 'guest')),
  held_on date not null default current_date, title text, attendees int, notes text,
  created_by_name text, created_at timestamptz not null default now()
);
create table if not exists public.cult_occasions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null, person_name text not null,
  kind text not null, held_on date not null default current_date, message text, sent_at timestamptz,
  created_by_name text, created_at timestamptz not null default now()
);
create table if not exists public.cult_onboard (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null, person_name text not null,
  joined_on date not null default current_date, mentor_name text, checks jsonb not null default '{}', notes text,
  created_by_name text, created_at timestamptz not null default now()
);
create table if not exists public.cult_ideas (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.users(id) on delete cascade, author_name text,
  title text not null, body text,
  status text not null default 'new' check (status in ('new', 'review', 'adopted', 'honored', 'closed')),
  reply text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.cult_meetings enable row level security;
alter table public.cult_occasions enable row level security;
alter table public.cult_onboard enable row level security;
alter table public.cult_ideas enable row level security;
drop policy if exists cult_meet_all on public.cult_meetings;
create policy cult_meet_all on public.cult_meetings for all to authenticated using (public.cult_member()) with check (public.cult_member());
drop policy if exists cult_occ_all on public.cult_occasions;
create policy cult_occ_all on public.cult_occasions for all to authenticated using (public.cult_member()) with check (public.cult_member());
drop policy if exists cult_onb_all on public.cult_onboard;
create policy cult_onb_all on public.cult_onboard for all to authenticated using (public.cult_member()) with check (public.cult_member());
-- الأفكار: يكتبها كل موظف ويرى أفكاره، والفريق يرى الكل ويرد
drop policy if exists cult_ideas_read on public.cult_ideas;
create policy cult_ideas_read on public.cult_ideas for select to authenticated using (author_id = auth.uid() or public.cult_member());
drop policy if exists cult_ideas_add on public.cult_ideas;
create policy cult_ideas_add on public.cult_ideas for insert to authenticated with check (author_id = auth.uid() and public.cult_staff_user());
drop policy if exists cult_ideas_edit on public.cult_ideas;
create policy cult_ideas_edit on public.cult_ideas for update to authenticated using (public.cult_member()) with check (public.cult_member());
drop policy if exists cult_ideas_del on public.cult_ideas;
create policy cult_ideas_del on public.cult_ideas for delete to authenticated using (public.cult_amb() or (author_id = auth.uid() and status = 'new'));
grant select, insert, update, delete on public.cult_meetings, public.cult_occasions, public.cult_onboard, public.cult_ideas to authenticated;

-- إشعار الموظفين من سفير الثقافة: لأشخاص بأعيانهم، أو لكل الموظفين إن لم يُحدَّدوا (رسائل التوعية ومزايا)
create or replace function public.cult_notify(p_title text, p_body text, p_user_ids uuid[] default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare ids uuid[];
begin
  if not public.cult_amb() then raise exception 'إشعار الموظفين لسفير الثقافة'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'اكتب عنوان الإشعار'; end if;
  ids := coalesce(p_user_ids, (select array_agg(id) from users where is_active and role::text in ('teacher', 'admin')));
  return public.send_notification(trim(p_title), nullif(trim(coalesce(p_body, '')), ''), 'general', null, null, ids, null, null, true);
end $$;
revoke all on function public.cult_notify(text, text, uuid[]) from public, anon;
grant execute on function public.cult_notify(text, text, uuid[]) to authenticated;

-- نهاية الجزء 3
