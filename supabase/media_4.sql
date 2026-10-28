-- =====================================================================
-- استوديو الوسائط (الجزء 4): البطاقة الإعلامية ووسم الفريق في بطاقة الاسم.
-- • media_team_staff: قادة الفريق من المعلمين؛ يُضاف إليه من يُختار في ترشّح القيادة
--   لإعلان مربوط بالفريق الإعلامي (nominations_7 وmedia_3).
-- • media_card_me(): بيانات البطاقة لصاحب الحساب، ومعها قوة الفريق (أعضاؤه وفروعه وأعماله).
-- • media_badge(p_student): فرع الطالب في الفريق، لوسم بطاقة الاسم.
-- يُنفَّذ بعد media_3.sql في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.media_team_staff (
  user_id   uuid primary key references public.users(id) on delete cascade,
  title     text not null default 'قائد الفريق الإعلامي',
  call_id   uuid references public.nom_calls(id) on delete set null,
  joined_at timestamptz not null default now()
);
alter table public.media_team_staff enable row level security;
drop policy if exists media_team_staff_manage on public.media_team_staff;
create policy media_team_staff_manage on public.media_team_staff for all to authenticated
  using (public.media_manager()) with check (public.media_manager());

-- اختيار المعلم قائدًا في إعلان مربوط بالفريق يضيفه للقادة، والعدول عنه يزيله
create or replace function public.media_staff_from_nom() returns trigger
language plpgsql security definer set search_path = public as $$
declare c nom_calls;
begin
  select * into c from nom_calls where id = new.call_id;
  if not coalesce(c.link_media, false) then return new; end if;
  if new.stage = 'accepted' then
    insert into media_team_staff (user_id, title, call_id) values (new.user_id, coalesce(c.staff_lead, 'قائد الفريق الإعلامي'), c.id)
    on conflict (user_id) do update set title = excluded.title, call_id = excluded.call_id;
  elsif old.stage = 'accepted' then
    delete from media_team_staff where user_id = new.user_id and call_id = c.id;
  end if;
  return new;
end $$;
drop trigger if exists media_staff_from_nom on public.nom_staff_apps;
create trigger media_staff_from_nom after update of stage on public.nom_staff_apps
  for each row execute function public.media_staff_from_nom();

create or replace function public.media_badge(p_student uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(branch, 'عضو') from media_team where student_id = p_student;
$$;

-- البطاقة: الصفة والفرع ورقم البطاقة بترتيب الانضمام، وقوة الفريق
create or replace function public.media_card_me() returns jsonb
language sql stable security definer set search_path = public as $$
  with me as (
    select 'student' as kind, v.full_name as name, coalesce(t.branch, 'عضو') as role,
           v.grade || '/' || v.class_no as cls, t.joined_at,
           (select count(*) from media_team x where x.joined_at <= t.joined_at) as no
      from media_team t join students s on s.id = t.student_id
      join v_active_students v on v.student_id = t.student_id where s.user_id = auth.uid()
    union all
    select 'staff', u.full_name, m.title, null, m.joined_at,
           (select count(*) from media_team_staff x where x.joined_at <= m.joined_at)
      from media_team_staff m join users u on u.id = m.user_id where m.user_id = auth.uid()
  )
  select jsonb_build_object('kind', me.kind, 'name', me.name, 'role', me.role, 'cls', me.cls,
           'joined_at', me.joined_at, 'no', me.no,
           'leaders', (select jsonb_agg(u.full_name order by m.joined_at) from media_team_staff m join users u on u.id = m.user_id),
           'members', (select count(*) from media_team),
           'items', (select count(*) from media_items where published),
           'videos', (select count(*) from media_items where published and kind = 'video'),
           'branches', (select jsonb_agg(jsonb_build_object('name', b, 'n', n) order by n desc)
                          from (select coalesce(branch, 'عضو') b, count(*) n from media_team group by 1) q))
    from me limit 1;
$$;

revoke all on function public.media_badge(uuid), public.media_card_me() from public, anon;
grant execute on function public.media_badge(uuid), public.media_card_me() to authenticated;

-- للتحقق
select (select count(*) from public.media_team) as "أعضاء الفريق",
       (select count(*) from public.media_team_staff) as "قادة الفريق";
-- نهاية الجزء 4
