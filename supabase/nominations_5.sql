-- =====================================================================
-- الترشيحات (الجزء 5): المقاعد المفتوحة، وفروع الإعلان. يُشغَّل بعد الجزء 4.
-- • seats فارغ = مقاعد مفتوحة بلا حد، والاحتياط حينها صفر دائمًا.
-- • branches: فروع الإعلان [{id, name, note, seats, reserve}] (مثل مسابقة القرآن: حفظ القرآن
--   كاملًا، حفظ 10 أجزاء…)، ولكل فرع مقاعده واحتياطه. الطالب يختار فرعًا واحدًا عند التقديم.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن، ويصلح قبل النشر وبعده.
-- =====================================================================
alter table public.nom_calls alter column seats drop not null;
alter table public.nom_calls add column if not exists branches jsonb not null default '[]';
alter table public.nom_calls drop constraint if exists nom_calls_open_reserve;
alter table public.nom_calls add constraint nom_calls_open_reserve check (seats is not null or reserve = 0);
alter table public.nom_applications add column if not exists branch text;

-- ما يراه الطالب وولي أمره من الطلب، ومعه الفرع
create or replace function public.nom_public_app(a nom_applications, c nom_calls) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('id', a.id, 'created_at', a.created_at, 'guardian_ok_at', a.guardian_ok_at, 'branch', a.branch,
    'stage', case when a.stage in ('accepted', 'reserve', 'rejected') and c.results_at is null then 'review' else a.stage end,
    'interview_at', case when a.stage <> 'withdrawn' then a.interview_at end,
    'interview_place', coalesce(a.interview_place, c.interview_place));
$$;

-- التقديم باختيار الفرع (إلزامي إن كان للإعلان فروع)
drop function if exists public.nom_apply(uuid, jsonb);
create or replace function public.nom_apply(p_call uuid, p_answers jsonb, p_branch text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_st uuid; v_grade int; c nom_calls; v_el jsonb; v_id uuid;
begin
  select s.id, v.grade into v_st, v_grade from students s join v_active_students v on v.student_id = s.id
   where s.user_id = auth.uid() limit 1;
  select * into c from nom_calls where id = p_call;
  if v_st is null or c.id is null or not c.published or c.cancelled_at is not null then raise exception 'الإعلان غير متاح'; end if;
  if current_date not between c.opens_on and c.closes_on then raise exception 'التقديم مغلق'; end if;
  if not v_grade = any(c.grades) then raise exception 'الإعلان ليس لصفك'; end if;
  if jsonb_array_length(c.branches) > 0 then
    if not exists (select 1 from jsonb_array_elements(c.branches) b where b->>'id' = p_branch) then raise exception 'اختر الفرع'; end if;
  else p_branch := null;
  end if;
  v_el := public.nom_eligibility(v_st, c.rules);
  if not (v_el->>'ok')::boolean then raise exception 'لا تنطبق عليك شروط الإعلان'; end if;
  insert into nom_applications (call_id, student_id, answers, eligibility, branch)
  values (p_call, v_st, coalesce(p_answers, '{}'), v_el, p_branch)
  on conflict (call_id, student_id) do update set answers = excluded.answers, eligibility = excluded.eligibility,
    branch = excluded.branch, stage = 'applied', updated_at = now() where nom_applications.stage = 'withdrawn'
  returning id into v_id;
  if v_id is null then raise exception 'سبق أن قدّمت على هذا الإعلان'; end if;
  return v_id;
end $$;

-- المتقدمون على الإعلان، ومعهم الفرع
create or replace function public.nom_applicants(p_call uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.nom_owns(p_call) then raise exception 'غير مصرّح'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'student_id', a.student_id, 'name', s.full_name, 'grade', v.grade, 'class_no', v.class_no,
      'answers', a.answers, 'eligibility', a.eligibility, 'stage', a.stage, 'guardian_ok_at', a.guardian_ok_at,
      'interview_at', a.interview_at, 'interview_place', a.interview_place, 'scores', a.scores,
      'interview_note', a.interview_note, 'created_at', a.created_at, 'branch', a.branch,
      'notify', (select coalesce(jsonb_agg(x.uid), '[]') from (
          select s.user_id uid where s.user_id is not null
          union select g.user_id from guardian_student gs join guardians g on g.id = gs.guardian_id
           where gs.student_id = s.id and g.user_id is not null and g.is_active) x)
    ) order by a.created_at)
    from nom_applications a join students s on s.id = a.student_id
    left join v_active_students v on v.student_id = s.id
   where a.call_id = p_call), '[]');
end $$;

revoke all on function public.nom_apply(uuid, jsonb, text) from public, anon;
grant execute on function public.nom_apply(uuid, jsonb, text) to authenticated;

-- للتحقق
select count(*) as "الإعلانات",
       count(*) filter (where seats is null) as "بمقاعد مفتوحة",
       count(*) filter (where jsonb_array_length(branches) > 0) as "بفروع"
  from public.nom_calls;
-- نهاية الجزء 5
