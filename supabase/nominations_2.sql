-- =====================================================================
-- الترشيحات (الجزء 2 من 4): الشروط التلقائية، وصفحة الطالب (الإعلانات المفتوحة لصفه وطلباته)
-- والتقديم والانسحاب. النتيجة لا تظهر للطالب قبل إعلانها. يُشغَّل بعد الجزء 1.
-- =====================================================================

-- شروط الطالب في الفصل الحالي: نسبة الحضور، وأعلى درجة مخالفة، ومتوسط الاختبارات
create or replace function public.nom_eligibility(p_student uuid, p_rules jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_from date; v_days int; v_abs int; v_att numeric; v_deg int; v_avg numeric; v_fails text[] := '{}';
begin
  select min(attend_date), count(*) into v_from, v_days from official_attendance_days
   where academic_year = (select value from settings where key = 'active_year')
     and term::text = (select value from settings where key = 'active_term');
  v_from := coalesce(v_from, current_date - 90);
  select count(*) into v_abs from official_day_marks where student_id = p_student and status = 'absent' and attend_date >= v_from;
  v_att := case when v_days > 0 then round(100.0 * (v_days - v_abs) / v_days, 1) end;
  v_deg := greatest(
    coalesce((select max(violation_degree) from behavior_forms where student_id = p_student and created_at >= v_from), 0),
    coalesce((select max(violation_degree) from student_actions where student_id = p_student and action_date >= v_from), 0));
  select round(avg(100.0 * s.score / nullif(q.total_marks, 0)), 1) into v_avg
    from quiz_submissions s join quizzes q on q.id = s.quiz_id
   where s.student_id = p_student and not s.absent and s.score is not null and q.status <> 'draft' and q.created_at >= v_from;
  if (p_rules->>'min_attend') is not null and coalesce(v_att, 100) < (p_rules->>'min_attend')::numeric then v_fails := v_fails || 'attend'; end if;
  if (p_rules->>'max_degree') is not null and v_deg > (p_rules->>'max_degree')::int then v_fails := v_fails || 'degree'; end if;
  if (p_rules->>'min_avg') is not null and v_avg < (p_rules->>'min_avg')::numeric then v_fails := v_fails || 'avg'; end if;
  return jsonb_build_object('attend', v_att, 'max_degree', v_deg, 'avg', v_avg, 'ok', cardinality(v_fails) = 0, 'fails', to_jsonb(v_fails));
end $$;

-- ما يراه الطالب وولي أمره من الطلب: القرار يُخفى («قيد الدراسة») حتى إعلان النتائج
create or replace function public.nom_public_app(a nom_applications, c nom_calls) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('id', a.id, 'created_at', a.created_at, 'guardian_ok_at', a.guardian_ok_at,
    'stage', case when a.stage in ('accepted', 'reserve', 'rejected') and c.results_at is null then 'review' else a.stage end,
    'interview_at', case when a.stage <> 'withdrawn' then a.interview_at end,
    'interview_place', coalesce(a.interview_place, c.interview_place));
$$;

-- الإعلانات المفتوحة لصف الطالب، والتي قدّم عليها
create or replace function public.nom_student_calls() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_st uuid; v_grade int;
begin
  select s.id, v.grade into v_st, v_grade from students s left join v_active_students v on v.student_id = s.id
   where s.user_id = auth.uid() limit 1;
  if v_st is null then return '[]'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('call', to_jsonb(c) - 'owner_id' - 'criteria',
      'app', case when a.id is not null then public.nom_public_app(a, c) end,
      'eligibility', public.nom_eligibility(v_st, c.rules)) order by c.closes_on desc)
    from nom_calls c left join nom_applications a on a.call_id = c.id and a.student_id = v_st
   where c.published and c.cancelled_at is null and c.opens_on <= current_date
     and ((v_grade = any(c.grades) and c.closes_on >= current_date) or a.id is not null)), '[]');
end $$;

create or replace function public.nom_apply(p_call uuid, p_answers jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_st uuid; v_grade int; c nom_calls; v_el jsonb; v_id uuid;
begin
  select s.id, v.grade into v_st, v_grade from students s join v_active_students v on v.student_id = s.id
   where s.user_id = auth.uid() limit 1;
  select * into c from nom_calls where id = p_call;
  if v_st is null or c.id is null or not c.published or c.cancelled_at is not null then raise exception 'الإعلان غير متاح'; end if;
  if current_date not between c.opens_on and c.closes_on then raise exception 'التقديم مغلق'; end if;
  if not v_grade = any(c.grades) then raise exception 'الإعلان ليس لصفك'; end if;
  v_el := public.nom_eligibility(v_st, c.rules);
  if not (v_el->>'ok')::boolean then raise exception 'لا تنطبق عليك شروط الإعلان'; end if;
  insert into nom_applications (call_id, student_id, answers, eligibility)
  values (p_call, v_st, coalesce(p_answers, '{}'), v_el)
  on conflict (call_id, student_id) do update set answers = excluded.answers, eligibility = excluded.eligibility,
    stage = 'applied', updated_at = now() where nom_applications.stage = 'withdrawn'
  returning id into v_id;
  if v_id is null then raise exception 'سبق أن قدّمت على هذا الإعلان'; end if;
  return v_id;
end $$;

create or replace function public.nom_withdraw(p_call uuid) returns void
language sql security definer set search_path = public as $$
  update nom_applications a set stage = 'withdrawn', updated_at = now()
   from nom_calls c where c.id = a.call_id and a.call_id = p_call and c.results_at is null
     and a.student_id = (select id from students where user_id = auth.uid() limit 1);
$$;

revoke all on function public.nom_eligibility(uuid, jsonb), public.nom_student_calls(), public.nom_apply(uuid, jsonb), public.nom_withdraw(uuid) from public, anon;
grant execute on function public.nom_student_calls(), public.nom_apply(uuid, jsonb), public.nom_withdraw(uuid) to authenticated;
-- نهاية الجزء 2
