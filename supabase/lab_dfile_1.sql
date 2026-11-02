-- ملف محضر المعمل الرقمي (1 من 2): بنظام ملف المعلم الرقمي نفسه — تفعيل ورمز ثابت ورابط للزائر
-- (/f/ML-XXXX)، وإعدادات العرض، وسجل الزوار في dfile_visits نفسه (kind = 'lab').
-- يُنفَّذ بعد teacher_dfile_1..9.sql وlab_perf_1..3.sql. تكرار التنفيذ آمن.

create table if not exists public.lab_dfiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  code text not null unique,
  color text not null default 'science',
  hidden text[] not null default '{}',
  appoint_year integer, perf_rating numeric(3,2) check (perf_rating between 1 and 5), perf_year integer,
  other_wins jsonb not null default '[]'::jsonb,
  photo_path text, share_msg text,
  lab_author boolean not null default false,   -- أعدّ دروس المعمل الرقمي
  enabled_at timestamptz not null default now(),
  disabled_at timestamptz, disabled_by uuid,
  updated_at timestamptz not null default now()
);

-- الرمز ML- وأربعة أحرف (رموز المعلمين MS-)، ولا يغيّره المحضر ولا يوقف ملفه؛ الإيقاف للدعم الفني
create or replace function public.lab_dfiles_guard()
returns trigger language plpgsql set search_path = public as $$
declare abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text;
begin
  if tg_op = 'INSERT' then
    loop
      c := 'ML-';
      for i in 1..4 loop c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
      exit when not exists (select 1 from public.lab_dfiles where code = c);
    end loop;
    new.code := c; new.disabled_at := null; new.disabled_by := null;
  else
    new.user_id := old.user_id; new.code := old.code;
    if not public.has_admin_role(array['tech_support']) then
      new.disabled_at := old.disabled_at; new.disabled_by := old.disabled_by;
    end if;
  end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists lab_dfiles_guard on public.lab_dfiles;
create trigger lab_dfiles_guard before insert or update on public.lab_dfiles
  for each row execute function public.lab_dfiles_guard();

alter table public.lab_dfiles enable row level security;
drop policy if exists lab_dfiles_read on public.lab_dfiles;
create policy lab_dfiles_read on public.lab_dfiles for select to authenticated
  using (user_id = auth.uid() or public.has_admin_role(array['principal', 'tech_support']));
drop policy if exists lab_dfiles_insert on public.lab_dfiles;
create policy lab_dfiles_insert on public.lab_dfiles for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.admin_roles r
    where r.user_id = auth.uid() and r.role_type::text = 'computer_lab'));
drop policy if exists lab_dfiles_update on public.lab_dfiles;
create policy lab_dfiles_update on public.lab_dfiles for update to authenticated
  using (user_id = auth.uid() or public.has_admin_role(array['tech_support']))
  with check (user_id = auth.uid() or public.has_admin_role(array['tech_support']));
grant select, insert, update on public.lab_dfiles to authenticated;

-- سجل الزوار نفسه: نوع الملف، وبدء الزيارة برمز ملف المحضر (المدة والملاحظة بدوالهما الحالية)
alter table public.dfile_visits add column if not exists kind text not null default 'teacher';
create or replace function public.lab_dfile_visit_start(p_code text, p_name text, p_org text, p_via text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare uid uuid; vid uuid;
begin
  select user_id into uid from public.lab_dfiles where code = upper(trim(p_code)) and disabled_at is null;
  if uid is null or uid = auth.uid() then return null; end if;
  insert into public.dfile_visits (teacher_user_id, visitor_name, visitor_org, via, kind)
  values (uid, nullif(left(trim(coalesce(p_name, '')), 80), ''), nullif(left(trim(coalesce(p_org, '')), 80), ''),
          case when p_via in ('qr', 'wa') then p_via else 'link' end, 'lab')
  returning id into vid;
  return vid;
end; $$;
revoke execute on function public.lab_dfile_visit_start(text, text, text, text) from public;
grant execute on function public.lab_dfile_visit_start(text, text, text, text) to anon, authenticated;
-- نهاية الجزء 1
