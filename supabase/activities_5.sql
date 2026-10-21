-- =====================================================================
-- بنك الأنشطة (الجزء 5): اطلاع الدعم الفني والمدير ووكيل الشؤون التعليمية على دوري المادة
-- وكأسها في كل الفصول، للتقييم ومساعدة المعلمين: قراءة فقط، والمنح والتعديل للمعلم وحده.
-- يُشغَّل بعد الجزء 2. تكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.act_viewer() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['tech_support', 'principal', 'deputy_academic']);
$$;

drop policy if exists "cup groups viewer" on public.subject_cup_groups;
create policy "cup groups viewer" on public.subject_cup_groups for select to authenticated using (public.act_viewer());
drop policy if exists "league points viewer" on public.subject_league_points;
create policy "league points viewer" on public.subject_league_points for select to authenticated using (public.act_viewer());

-- اللوحة: لمعلم المادة، وللاطلاع
create or replace function public.act_league_board(p_class uuid, p_subject uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_term text := public.lab_term_key();
begin
  if not public.act_teaches(p_class, p_subject) and not public.act_viewer() then
    raise exception 'لست معلم هذه المادة لهذا الفصل'; end if;
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

-- كل الفصول والمواد التي فيها دوري أو كأس في الفصل الدراسي الحالي، بمعلميها وأرقامها
create or replace function public.act_league_overview()
returns table (class_id uuid, class_no int, grade int, subject_id uuid, subject text, teachers text,
               grants int, total int, students int, groups int, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_term text := public.lab_term_key(); v_year text := (select value from settings where key = 'active_year');
begin
  if not public.act_viewer() then raise exception 'غير مصرّح'; end if;
  return query
  with k as (select p.class_id c, p.subject_id s from subject_league_points p where p.term_key = v_term
             union select g.class_id, g.subject_id from subject_cup_groups g where g.term_key = v_term)
  select k.c, cl.class_no, cl.grade, k.s, sub.name::text,
         (select string_agg(distinct t.full_name, '، ') from schedule sc join teachers t on t.id = sc.teacher_id
           where sc.class_id = k.c and sc.subject_id = k.s and sc.academic_year = coalesce(v_year, sc.academic_year))::text,
         (select count(*)::int from subject_league_points p where p.class_id = k.c and p.subject_id = k.s and p.term_key = v_term),
         (select coalesce(sum(p.points), 0)::int from subject_league_points p where p.class_id = k.c and p.subject_id = k.s and p.term_key = v_term),
         (select count(distinct p.student_id)::int from subject_league_points p where p.class_id = k.c and p.subject_id = k.s and p.term_key = v_term),
         (select count(*)::int from subject_cup_groups g where g.class_id = k.c and g.subject_id = k.s and g.term_key = v_term),
         (select max(p.created_at) from subject_league_points p where p.class_id = k.c and p.subject_id = k.s and p.term_key = v_term)
    from k join classes cl on cl.id = k.c left join subjects sub on sub.id = k.s
   order by cl.grade, cl.class_no, sub.name;
end $$;

-- سجل المنح لفصل ومادة: متى، ولمن، وكم، ولماذا، ومن منح
create or replace function public.act_league_log(p_class uuid, p_subject uuid)
returns table (given_at timestamptz, target text, cup boolean, points int, reason text, by_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.act_teaches(p_class, p_subject) and not public.act_viewer() then raise exception 'غير مصرّح'; end if;
  return query
  select p.created_at, coalesce(st.full_name, g.name)::text, p.group_id is not null, p.points, p.reason,
         (select u.full_name from users u where u.id = p.created_by)::text
    from subject_league_points p
    left join students st on st.id = p.student_id left join subject_cup_groups g on g.id = p.group_id
   where p.class_id = p_class and p.subject_id = p_subject and p.term_key = public.lab_term_key()
   order by p.created_at desc limit 200;
end $$;

revoke all on function public.act_viewer(), public.act_league_overview(), public.act_league_log(uuid, uuid) from public, anon;
grant execute on function public.act_viewer(), public.act_league_overview(), public.act_league_log(uuid, uuid) to authenticated;
-- نهاية الجزء 5
