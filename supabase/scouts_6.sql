-- =====================================================================
-- الفريق الكشفي (الجزء 6): التحضير والتقييم. يُنفَّذ بعد scouts_5.sql.
-- • scout_attendance: تحضير الاصطفاف الصباحي (lineup) والفسحة (recess) لكل يوم.
--   يحضّر القائد ونائبه الفريق كله في أي يوم، والعريف الأول ونائبه الفريق كله اليوم،
--   وعريف الطليعة ونائبه طليعتهم اليوم (من حساب الطالب عبر scout_attend).
-- • scout_evals: التقييم الأسبوعي للطليعة وللعضو (للقائد ونائبه)، بمعايير من 10.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.scout_attendance (
  att_date date not null,
  kind text not null check (kind in ('lineup', 'recess')),
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  by_user uuid default auth.uid(), by_name text,
  at timestamptz not null default now(),
  primary key (att_date, kind, student_id)
);

create table if not exists public.scout_evals (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,                     -- أحد الأسبوع
  patrol_id uuid references public.scout_patrols(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  scores jsonb not null default '{}',           -- {discipline, tasks, appearance, cooperation}
  note text,
  by_user uuid default auth.uid(), by_name text,
  updated_at timestamptz not null default now(),
  check ((patrol_id is null) <> (student_id is null))
);
create unique index if not exists scout_evals_patrol on public.scout_evals (week_start, patrol_id) where patrol_id is not null;
create unique index if not exists scout_evals_member on public.scout_evals (week_start, student_id) where student_id is not null;

alter table public.scout_attendance enable row level security;
alter table public.scout_evals enable row level security;
drop policy if exists scout_att_all on public.scout_attendance;
create policy scout_att_all on public.scout_attendance for all to authenticated
  using (public.scout_staff()) with check (public.scout_staff());
drop policy if exists scout_att_admin on public.scout_attendance;
create policy scout_att_admin on public.scout_attendance for select to authenticated using (public.is_admin());
drop policy if exists scout_evals_all on public.scout_evals;
create policy scout_evals_all on public.scout_evals for all to authenticated
  using (public.scout_staff()) with check (public.scout_staff());
drop policy if exists scout_evals_admin on public.scout_evals;
create policy scout_evals_admin on public.scout_evals for select to authenticated using (public.is_admin());

-- حساب الطالب في الفريق: منصبه وطليعته ومهامها، ومن يحضّرهم وتحضير اليوم
create or replace function public.scout_my() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m scout_members; v_today date := (now() at time zone 'Asia/Riyadh')::date; v_all boolean; v_can boolean;
begin
  select sm.* into m from scout_members sm join students s on s.id = sm.student_id where s.user_id = auth.uid() limit 1;
  if m.student_id is null then return null; end if;
  v_all := m.post in ('chief', 'chief_deputy');
  v_can := m.can_attend and m.post <> 'member';
  return jsonb_build_object('post', m.post, 'can_attend', v_can, 'today', v_today,
    'patrol', (select to_jsonb(p) from scout_patrols p where p.id = m.patrol_id),
    'mates', (select coalesce(jsonb_agg(jsonb_build_object('id', x.student_id, 'name', s.full_name, 'post', x.post) order by x.post <> 'patrol_leader', x.post <> 'patrol_deputy', s.full_name), '[]')
                from scout_members x join students s on s.id = x.student_id where m.patrol_id is not null and x.patrol_id = m.patrol_id),
    'roster', case when v_can then (select coalesce(jsonb_agg(jsonb_build_object('id', x.student_id, 'name', s.full_name, 'patrol', p.name,
        'lineup', (select a.status from scout_attendance a where a.att_date = v_today and a.kind = 'lineup' and a.student_id = x.student_id),
        'recess', (select a.status from scout_attendance a where a.att_date = v_today and a.kind = 'recess' and a.student_id = x.student_id))
        order by p.sort, p.name, s.full_name), '[]')
      from scout_members x join students s on s.id = x.student_id left join scout_patrols p on p.id = x.patrol_id
     where v_all or x.patrol_id = m.patrol_id) end);
end $$;

-- تحضير العريف لطليعته (أو العريف الأول للفريق) لليوم فقط: p_marks = [{id, status}]
create or replace function public.scout_attend(p_kind text, p_marks jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare m scout_members; v_today date := (now() at time zone 'Asia/Riyadh')::date; v_name text; n int;
begin
  select sm.* into m from scout_members sm join students s on s.id = sm.student_id where s.user_id = auth.uid() limit 1;
  if m.student_id is null or m.post = 'member' or not m.can_attend then raise exception 'ليست لك صلاحية التحضير'; end if;
  if p_kind not in ('lineup', 'recess') then raise exception 'نوع التحضير غير معروف'; end if;
  select full_name into v_name from students where id = m.student_id;
  insert into scout_attendance (att_date, kind, student_id, status, by_user, by_name, at)
  select v_today, p_kind, (e->>'id')::uuid, e->>'status', auth.uid(), v_name, now()
    from jsonb_array_elements(p_marks) e join scout_members x on x.student_id = (e->>'id')::uuid
   where e->>'status' in ('present', 'absent', 'late', 'excused')
     and (m.post in ('chief', 'chief_deputy') or x.patrol_id = m.patrol_id)
  on conflict (att_date, kind, student_id) do update set status = excluded.status, by_user = excluded.by_user,
    by_name = excluded.by_name, at = now();
  get diagnostics n = row_count;
  return n;
end $$;

-- جوال ولي الأمر في كشف الفريق للقائد ونائبه أيضًا
create or replace function public.scout_roster() returns table (student_id uuid, mobile text)
language sql stable security definer set search_path = public as $$
  select m.student_id, (select g.mobile from guardian_student gs join guardians g on g.id = gs.guardian_id
                         where gs.student_id = m.student_id and coalesce(g.mobile, '') <> '' order by g.is_active desc limit 1)
    from scout_members m where public.scout_staff();
$$;

revoke all on function public.scout_my(), public.scout_attend(text, jsonb) from public, anon;
grant execute on function public.scout_my(), public.scout_attend(text, jsonb) to authenticated;
-- نهاية الجزء 6
