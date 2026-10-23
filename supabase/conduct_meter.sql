-- =====================================================================
-- مؤشر السلوك في رئيسية الطالب وولي الأمر (الجزء 1 من 1). تقديري من سجل البوابة منذ بداية العام،
-- لأن درجة نور لا تُرصد إلا في نهايته: يبدأ السلوك الإيجابي من 80 ويُحسم لكل مخالفة بحسب درجتها
-- كما في دليل السلوك والمواظبة (1، 2، 3، 10، 15)، ومعه الجوانب الإيجابية.
-- • المخالفة: نماذج السلوك بدرجتها، وتدوين المعلم لها. المكرر (الدرجة والنص واليوم نفسه) يُحتسب مرة.
-- • لا يُعاد نص المخالفة ولا الملاحظات ولا التوجيه: الدرجات والأعداد والتواريخ فقط.
-- • يقرؤه الطالب نفسه، وولي أمره، ومن يرى ملف الطالب. تكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.student_conduct_meter(p_student uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_from date; v_uid uuid; v jsonb; v_viol jsonb; v_ded int; v_noms int := 0; v_scout boolean := false; v_league int := 0;
begin
  select user_id into v_uid from students where id = p_student;
  if not (v_uid = auth.uid()
          or exists (select 1 from guardian_student gs join guardians g on g.id = gs.guardian_id
                      where gs.student_id = p_student and g.user_id = auth.uid())
          or public.sf_can(p_student)) then
    raise exception 'غير مصرّح';
  end if;
  -- بداية العام: أول «بداية فصل» خلال الأحد عشر شهرًا الماضية
  select min(start_date) into v_from from academic_calendar
   where is_active and kind = 'term_start' and start_date <= current_date and start_date > current_date - 330;
  v_from := coalesce(v_from, current_date - 330);

  with x as (
    select distinct violation_degree d, lower(trim(coalesce(violation_text, ''))) t, coalesce(violation_date, created_at::date) dt
      from behavior_forms where student_id = p_student and violation_degree between 1 and 5
       and coalesce(violation_date, created_at::date) >= v_from
    union
    select distinct violation_degree, lower(trim(coalesce(violation_text, ''))), action_date
      from student_actions where student_id = p_student and category = 'behavior' and action = 'record'
       and violation_degree between 1 and 5 and action_date >= v_from)
  select coalesce(jsonb_agg(jsonb_build_object('degree', d, 'count', n, 'last', last) order by d), '[]'),
         coalesce(sum(n * (array[1, 2, 3, 10, 15])[d]), 0)
    into v_viol, v_ded
    from (select d, count(*) n, max(dt) last from x group by d) g;

  if to_regclass('public.nom_applications') is not null then
    execute 'select count(*) from nom_applications where student_id = $1 and stage = ''accepted'' and created_at >= $2'
      into v_noms using p_student, v_from;
  end if;
  if to_regclass('public.scout_members') is not null then
    execute 'select exists (select 1 from scout_members where student_id = $1)' into v_scout using p_student;
  end if;
  if to_regclass('public.subject_league_points') is not null then
    execute 'select coalesce(sum(points), 0) from subject_league_points where student_id = $1 and created_at >= $2'
      into v_league using p_student, v_from;
  end if;

  select jsonb_build_object(
    'from', v_from, 'base', 80, 'deducted', v_ded, 'score', greatest(0, 80 - v_ded), 'violations', v_viol,
    'certificates', (select count(*) from form_documents d join form_templates t on t.id = d.template_id
                      where d.student_id = p_student and t.category = 'certificate'
                        and d.status in ('issued', 'approved') and d.created_at >= v_from),
    'events', (select count(*) from event_participants p join school_events e on e.id = p.event_id
                where p.student_id = p_student and e.cancelled_at is null and p.attended is not false
                  and e.event_date between v_from and current_date),
    'nominations', v_noms, 'scout', v_scout, 'league', v_league,
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('t', t, 'd', d) order by d desc), '[]') from (
                 select d.title t, d.created_at::date d from form_documents d join form_templates t on t.id = d.template_id
                  where d.student_id = p_student and t.category = 'certificate'
                    and d.status in ('issued', 'approved') and d.created_at >= v_from
                 union all
                 select e.title, e.event_date from event_participants p join school_events e on e.id = p.event_id
                  where p.student_id = p_student and e.cancelled_at is null and p.attended is not false
                    and e.event_date between v_from and current_date
                 order by 2 desc limit 4) y)
  ) into v;
  return v;
end $$;

revoke all on function public.student_conduct_meter(uuid) from public, anon;
grant execute on function public.student_conduct_meter(uuid) to authenticated;
-- نهاية الجزء 1
