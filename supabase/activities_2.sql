-- =====================================================================
-- بنك الأنشطة (الجزء 2 من 2): دوري المادة (أفراد) وكأس المادة (مجموعات)
-- لكل فصل ومادة في الفصل الدراسي الحالي (lab_term_key)، بين طلاب الفصل فقط.
-- يمنح النقاط معلم المادة لذلك الفصل (من الجدول الدراسي). يُنفَّذ بعد الجزء 1
-- وبعد computer_lab_5.sql (lab_term_key). تكرار التنفيذ آمن.
-- =====================================================================

-- هل المستخدم معلم هذه المادة لهذا الفصل في العام الحالي؟
create or replace function public.act_teaches(p_class uuid, p_subject uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from schedule s join teachers t on t.id = s.teacher_id
    where t.user_id = auth.uid() and s.class_id = p_class and s.subject_id = p_subject
      and s.academic_year = coalesce((select value from settings where key = 'active_year'), s.academic_year));
$$;

create table if not exists public.subject_cup_groups (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null,
  subject_id uuid not null,
  term_key   text not null default public.lab_term_key(),
  name       text not null,
  color      text,
  members    uuid[] not null default '{}',
  sort       int not null default 0
);

create table if not exists public.subject_league_points (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null,
  subject_id uuid not null,
  term_key   text not null default public.lab_term_key(),
  student_id uuid,                                  -- الدوري (فرد)
  group_id   uuid references public.subject_cup_groups(id) on delete cascade,  -- الكأس (مجموعة)
  points     int not null check (points between -20 and 50 and points <> 0),
  reason     text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (num_nonnulls(student_id, group_id) = 1)
);
create index if not exists league_points_key on public.subject_league_points (class_id, subject_id, term_key);

alter table public.subject_cup_groups enable row level security;
alter table public.subject_league_points enable row level security;
drop policy if exists "cup groups teacher" on public.subject_cup_groups;
create policy "cup groups teacher" on public.subject_cup_groups for all to authenticated
  using (public.act_teaches(class_id, subject_id)) with check (public.act_teaches(class_id, subject_id));
drop policy if exists "league points teacher" on public.subject_league_points;
create policy "league points teacher" on public.subject_league_points for all to authenticated
  using (public.act_teaches(class_id, subject_id)) with check (public.act_teaches(class_id, subject_id));
grant select, insert, update, delete on public.subject_cup_groups, public.subject_league_points to authenticated;

-- فصول المعلم وموادها (للأدوات والدوري)
create or replace function public.act_my_classes()
returns table (class_id uuid, class_no int, grade int, subject_id uuid, subject text)
language sql stable security definer set search_path = public as $$
  select distinct s.class_id, c.class_no, c.grade, s.subject_id, sub.name
    from schedule s join teachers t on t.id = s.teacher_id and t.user_id = auth.uid()
    join classes c on c.id = s.class_id left join subjects sub on sub.id = s.subject_id
   where s.subject_id is not null
     and s.academic_year = coalesce((select value from settings where key = 'active_year'), s.academic_year)
   order by c.grade, c.class_no;
$$;

-- لوحة الدوري والكأس: طلاب الفصل بنقاطهم، والمجموعات بنقاطها، للفصل الدراسي الحالي
create or replace function public.act_league_board(p_class uuid, p_subject uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_term text := public.lab_term_key();
begin
  if not public.act_teaches(p_class, p_subject) then raise exception 'لست معلم هذه المادة لهذا الفصل'; end if;
  return jsonb_build_object(
    'students', (select coalesce(jsonb_agg(jsonb_build_object('id', st.id, 'name', st.full_name,
        'points', coalesce((select sum(points) from subject_league_points p where p.class_id = p_class
          and p.subject_id = p_subject and p.term_key = v_term and p.student_id = st.id), 0)) order by st.full_name), '[]')
      from student_enrollment e join students st on st.id = e.student_id
      where e.class_id = p_class and e.status = 'active'),
    'groups', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'color', g.color, 'members', g.members,
        'points', coalesce((select sum(points) from subject_league_points p where p.group_id = g.id), 0)) order by g.sort, g.name), '[]')
      from subject_cup_groups g where g.class_id = p_class and g.subject_id = p_subject and g.term_key = v_term));
end $$;

revoke all on function public.act_teaches(uuid, uuid), public.act_my_classes(), public.act_league_board(uuid, uuid) from public, anon;
grant execute on function public.act_teaches(uuid, uuid), public.act_my_classes(), public.act_league_board(uuid, uuid) to authenticated;

-- نهاية الجزء 2
