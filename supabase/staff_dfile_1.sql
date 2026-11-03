-- الملف الرقمي للموظفين (1 من 2): الوكلاء والموجهون الطلابيون ومحضرو مختبرات العلوم، بنظام ملف محضر المعمل
-- الرقمي نفسه: تفعيل ورمز ثابت (MW-XXXX) ورابط للزائر (/f/MW-XXXX)، وإعدادات العرض، وسجل الزوار
-- في dfile_visits نفسه (kind = 'staff'). يُنفَّذ بعد lab_dfile_1.sql وstaff_perf_1..6.sql. تكرار التنفيذ آمن.

create table if not exists public.staff_dfiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  code text not null unique,
  track text not null check (track in ('deputy', 'counselor', 'science')),
  color text not null default 'science',
  hidden text[] not null default '{}',
  appoint_year integer, perf_rating numeric(3,2) check (perf_rating between 1 and 5), perf_year integer,
  other_wins jsonb not null default '[]'::jsonb,
  photo_path text, share_msg text,
  enabled_at timestamptz not null default now(),
  disabled_at timestamptz, disabled_by uuid,
  updated_at timestamptz not null default now()
);

-- وظيفة صاحب الملف من أدواره، أو null إن لم تكن له وظيفة منها
create or replace function public.staff_dfile_track(p_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when bool_or(role_type::text like 'deputy\_%') then 'deputy'
              when bool_or(role_type::text ~ '^counselor_\d$') then 'counselor'
              when bool_or(role_type::text ~ '^science_labs') then 'science' end
    from public.admin_roles where user_id = p_uid;
$$;

-- الرمز MW- وأربعة أحرف، والوظيفة من الأدوار. لا يغيّر الموظف رمزه ولا يوقف ملفه؛ الإيقاف للدعم الفني
create or replace function public.staff_dfiles_guard()
returns trigger language plpgsql set search_path = public as $$
declare abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text;
begin
  if tg_op = 'INSERT' then
    loop
      c := 'MW-';
      for i in 1..4 loop c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
      exit when not exists (select 1 from public.staff_dfiles where code = c);
    end loop;
    new.code := c; new.disabled_at := null; new.disabled_by := null;
    new.track := public.staff_dfile_track(new.user_id);
  else
    new.user_id := old.user_id; new.code := old.code;
    new.track := coalesce(public.staff_dfile_track(old.user_id), old.track);
    if not public.has_admin_role(array['tech_support']) then
      new.disabled_at := old.disabled_at; new.disabled_by := old.disabled_by;
    end if;
  end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists staff_dfiles_guard on public.staff_dfiles;
create trigger staff_dfiles_guard before insert or update on public.staff_dfiles
  for each row execute function public.staff_dfiles_guard();

alter table public.staff_dfiles enable row level security;
drop policy if exists staff_dfiles_read on public.staff_dfiles;
create policy staff_dfiles_read on public.staff_dfiles for select to authenticated
  using (user_id = auth.uid() or public.has_admin_role(array['principal', 'tech_support']));
drop policy if exists staff_dfiles_insert on public.staff_dfiles;
create policy staff_dfiles_insert on public.staff_dfiles for insert to authenticated
  with check (user_id = auth.uid() and public.staff_dfile_track(auth.uid()) is not null);
drop policy if exists staff_dfiles_update on public.staff_dfiles;
create policy staff_dfiles_update on public.staff_dfiles for update to authenticated
  using (user_id = auth.uid() or public.has_admin_role(array['tech_support']))
  with check (user_id = auth.uid() or public.has_admin_role(array['tech_support']));
grant select, insert, update on public.staff_dfiles to authenticated;

-- بدء الزيارة برمز ملف الموظف (المدة والملاحظة بدوال ملف المعلم نفسها)
create or replace function public.staff_dfile_visit_start(p_code text, p_name text, p_org text, p_via text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare uid uuid; vid uuid;
begin
  select user_id into uid from public.staff_dfiles where code = upper(trim(p_code)) and disabled_at is null;
  if uid is null or uid = auth.uid() then return null; end if;
  insert into public.dfile_visits (teacher_user_id, visitor_name, visitor_org, via, kind)
  values (uid, nullif(left(trim(coalesce(p_name, '')), 80), ''), nullif(left(trim(coalesce(p_org, '')), 80), ''),
          case when p_via in ('qr', 'wa') then p_via else 'link' end, 'staff')
  returning id into vid;
  return vid;
end; $$;
revoke execute on function public.staff_dfile_visit_start(text, text, text, text) from public;
grant execute on function public.staff_dfile_visit_start(text, text, text, text) to anon, authenticated;
-- نهاية الجزء 1
