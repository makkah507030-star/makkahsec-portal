-- =====================================================================
-- استوديو الوسائط (الجزء 3): الفريق الإعلامي من الطلاب.
-- • media_team: أعضاء الفريق بفرعهم (تصوير، مونتاج، تحرير، تصميم).
-- • nom_calls.link_media: المقبولون في الإعلان يُضافون للفريق تلقائيًا عند إعلان النتائج.
-- • media_team_my(): عضوية الطالب، فتظهر له «فريقي الإعلامي».
-- • media_no_photo يُعاد تعريفه: يرى عضو الفريق من لا يُصوَّر بلا بيانات أولياء الأمور.
-- يُنفَّذ بعد media_2.sql وnominations_7.sql في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.media_team (
  student_id uuid primary key references public.students(id) on delete cascade,
  branch     text,
  call_id    uuid references public.nom_calls(id) on delete set null,
  joined_at  timestamptz not null default now()
);
alter table public.nom_calls add column if not exists link_media boolean not null default false;

alter table public.media_team enable row level security;
drop policy if exists media_team_manage on public.media_team;
create policy media_team_manage on public.media_team for all to authenticated
  using (public.media_manager()) with check (public.media_manager());

create or replace function public.media_team_my() returns table (branch text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.branch, t.joined_at from media_team t join students s on s.id = t.student_id where s.user_id = auth.uid();
$$;

-- أعضاء الفريق بأسمائهم وفصولهم، لمن يدير الاستوديو
create or replace function public.media_team_list()
returns table (student_id uuid, full_name text, grade int, class_no int, branch text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.student_id, v.full_name, v.grade::int, v.class_no::int, t.branch, t.joined_at
    from media_team t join v_active_students v on v.student_id = t.student_id
   where public.media_manager() order by v.grade, v.class_no, v.full_name;
$$;

-- عند إعلان النتائج: المقبولون يُضافون للفريق بفرعهم
create or replace function public.media_team_from_nom() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.link_media and new.results_at is not null and old.results_at is null then
    insert into media_team (student_id, branch, call_id)
    select a.student_id, (select b->>'name' from jsonb_array_elements(new.branches) b where b->>'id' = a.branch), new.id
      from nom_applications a where a.call_id = new.id and a.stage = 'accepted'
    on conflict (student_id) do update set branch = coalesce(excluded.branch, media_team.branch), call_id = excluded.call_id;
  end if;
  return new;
end $$;
drop trigger if exists media_team_from_nom on public.nom_calls;
create trigger media_team_from_nom after update of results_at on public.nom_calls
  for each row execute function public.media_team_from_nom();

-- من لا يُصوَّر: المدير يرى الكل بالتفاصيل، وعضو الفريق يرى من لا يُصوَّر فقط
create or replace function public.media_no_photo()
returns table (student_id uuid, full_name text, grade int, class_no int, status text, by_name text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select * from (
    select v.student_id, v.full_name, v.grade::int, v.class_no::int,
           case when c.allowed then 'allowed' when c.allowed = false then 'denied' else 'none' end as status,
           case when public.media_manager() then c.by_name end, case when public.media_manager() then c.updated_at end
      from v_active_students v
      left join media_consents c on c.student_id = v.student_id and c.academic_year = media_year()
     where public.media_manager() or exists (select 1 from public.media_team_my())) x
   where public.media_manager() or x.status <> 'allowed';
$$;

revoke all on function public.media_team_my(), public.media_team_list() from public, anon;
grant execute on function public.media_team_my(), public.media_team_list() to authenticated;

-- للتحقق
select count(*) as "أعضاء الفريق",
       (select count(*) from public.nom_calls where link_media) as "إعلانات مربوطة بالفريق"
  from public.media_team;
-- نهاية الجزء 3
