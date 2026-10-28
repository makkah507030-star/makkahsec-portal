-- =====================================================================
-- الفريق الكشفي (الجزء 7): بلاغات القائد ونائبه إلى وكيل شؤون الطلاب. بعد scouts_6.sql.
-- • scout_reports: بلاغ (تنظيم أو طلاب) بنصه وطلابه وصورة اختيارية، مفتوح حتى يُغلق.
-- • scout_report_msgs: المحادثة داخل البلاغ.
-- • يصل وكيلَ شؤون الطلاب إشعارٌ بكل بلاغ ورسالة من الفريق، ويصل صاحبَ البلاغ إشعار برد الوكيل.
-- • الأطراف: القائد ونائبه (scout_staff)، ووكيل شؤون الطلاب، والمدير والدعم الفني.
-- • صورة البلاغ في المخزن الخاص scout-files.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.scout_report_party() returns boolean
language sql stable security definer set search_path = public as $$
  select public.scout_staff() or public.has_admin_role(array['deputy_students', 'principal', 'tech_support']);
$$;

create table if not exists public.scout_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'organization' check (kind in ('organization', 'students')),
  title text not null check (length(trim(title)) > 0),
  body text,
  student_ids uuid[] not null default '{}',
  photo text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid default auth.uid(), created_by_name text,
  created_at timestamptz not null default now(),
  closed_at timestamptz, closed_by_name text
);
create table if not exists public.scout_report_msgs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.scout_reports(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  by_user uuid default auth.uid(), by_name text,
  from_deputy boolean not null default false,
  at timestamptz not null default now()
);
create index if not exists scout_report_msgs_report on public.scout_report_msgs (report_id, at);

alter table public.scout_reports enable row level security;
alter table public.scout_report_msgs enable row level security;
drop policy if exists scout_reports_all on public.scout_reports;
create policy scout_reports_all on public.scout_reports for all to authenticated
  using (public.scout_report_party()) with check (public.scout_report_party());
drop policy if exists scout_report_msgs_all on public.scout_report_msgs;
create policy scout_report_msgs_all on public.scout_report_msgs for all to authenticated
  using (public.scout_report_party()) with check (public.scout_report_party() and by_user = auth.uid());

-- الإشعارات: البلاغ ورسائل الفريق للوكيل، ورد الوكيل لصاحب البلاغ
create or replace function public.scout_report_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare uids uuid[]; r scout_reports; nid uuid; v_title text; v_body text;
begin
  if tg_table_name = 'scout_reports' then
    r := new; v_title := 'بلاغ من الفريق الكشفي'; v_body := new.title || coalesce(' — ' || new.created_by_name, '');
  else
    select * into r from scout_reports where id = new.report_id;
    v_title := 'رد في بلاغ الفريق الكشفي'; v_body := r.title || ': ' || left(new.body, 120);
  end if;
  if tg_table_name = 'scout_report_msgs' then
    if new.from_deputy then uids := array[r.created_by]; end if;
  end if;
  if uids is null then
    select array_agg(distinct a.user_id) into uids from admin_roles a join users u on u.id = a.user_id and u.is_active
     where a.role_type::text = 'deputy_students' and a.user_id is distinct from auth.uid();
  end if;
  if uids is not null and cardinality(uids) > 0 then
    nid := public.send_notification(v_title, v_body, 'general', '/scout-reports', null, uids, null, null, true);
    begin perform public.push_notification(nid); exception when others then null; end;
  end if;
  return new;
end $$;
drop trigger if exists scout_report_notify on public.scout_reports;
create trigger scout_report_notify after insert on public.scout_reports for each row execute function public.scout_report_notify();
drop trigger if exists scout_report_msg_notify on public.scout_report_msgs;
create trigger scout_report_msg_notify after insert on public.scout_report_msgs for each row execute function public.scout_report_notify();

-- صورة البلاغ
insert into storage.buckets (id, name, public) values ('scout-files', 'scout-files', false) on conflict (id) do nothing;
drop policy if exists "scout files access" on storage.objects;
create policy "scout files access" on storage.objects for all to authenticated
  using (bucket_id = 'scout-files' and public.scout_report_party())
  with check (bucket_id = 'scout-files' and public.scout_report_party());

revoke all on function public.scout_report_party() from public, anon;
grant execute on function public.scout_report_party() to authenticated;

-- للتحقق
select count(*) as "البلاغات", count(*) filter (where status = 'open') as "المفتوحة" from public.scout_reports;
-- نهاية الجزء 7
