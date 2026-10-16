-- حلقة التحسين — المرحلة الثانية (الجزء 2 من 3): قياس أثر الخطة العلاجية من اختبار التحقق.
-- • لكل طالب في الخطة: نسبته في الاختبار الأصلي (خط الأساس) مقابل نسبته في اختبار التحقق.
--   تحسّن = أعلى من خط الأساس، وبلغ = 60% فأكثر، ودونها (below) تلزمه خطة ثانية بدعم أعلى.
-- • p_skip: سبب تعذّر التحقق (نهاية الفصل مثلًا) فتُغلق الخطة بلا قياس.
-- • الجولة الثانية وما بقي فيها دون 60% يصل المدير إشعارًا.
-- يُنفَّذ بعد الجزء 1. تكرار التنفيذ آمن.

create or replace function public.quiz_plan_measure(p_plan uuid, p_skip text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  p public.quiz_plans;
  z public.quizzes;
  s jsonb;
  sc numeric;
  b0 numeric;
  n int := 0; up int := 0; pass int := 0; miss int := 0;
  sb numeric := 0; sa numeric := 0;
  list jsonb := '[]'::jsonb;
  r jsonb;
  boss uuid[];
begin
  select * into p from public.quiz_plans where id = p_plan for update;
  if not found or p.teacher_id is distinct from auth.uid() then raise exception 'الخطة غير موجودة أو ليست لك'; end if;
  if p.kind <> 'remedial' or p.status <> 'done' then raise exception 'يُقاس الأثر بعد تنفيذ الخطة العلاجية'; end if;

  if nullif(trim(coalesce(p_skip, '')), '') is not null then
    r := jsonb_build_object('skipped', left(trim(p_skip), 500));
  else
    select * into z from public.quizzes where id = p.verify_quiz_id and teacher_id = p.teacher_id;
    if not found then raise exception 'أنشئ اختبار التحقق أولًا'; end if;
    for s in select * from jsonb_array_elements(p.students) loop
      sc := null;
      select round(100 * q.score / nullif(z.total_marks, 0), 1) into sc from public.quiz_submissions q
       where q.quiz_id = z.id and q.student_id = (s->>'id')::uuid and not coalesce(q.absent, false) and q.score is not null
       limit 1;
      if sc is null then miss := miss + 1; continue; end if;
      b0 := coalesce((s->>'avg')::numeric, 0);
      n := n + 1; sb := sb + b0; sa := sa + sc;
      if sc > b0 then up := up + 1; end if;
      if sc >= 60 then pass := pass + 1; end if;
      list := list || jsonb_build_object('id', s->>'id', 'name', s->>'name', 'cls', s->>'cls', 'before', b0, 'after', sc);
    end loop;
    if n = 0 then raise exception 'لم تُرصد درجات طلاب الخطة في اختبار التحقق بعد'; end if;
    r := jsonb_build_object('n', n, 'improved', up, 'passed', pass, 'below', n - pass, 'missing', miss,
                            'before', round(sb / n, 1), 'after', round(sa / n, 1), 'students', list);
  end if;

  perform set_config('app.quiz_measure', '1', true);
  update public.quiz_plans set impact = r, measured_at = now(), updated_at = now() where id = p_plan;
  perform set_config('app.quiz_measure', '', true);

  if p.round >= 2 and coalesce((r->>'below')::int, 0) > 0 then
    select array_agg(user_id) into boss from public.admin_roles where role_type::text = 'principal';
    if boss is not null then
      perform public.send_notification('خطة علاجية ثانية لم يكتمل أثرها',
        (select coalesce(full_name, 'معلم') from public.users where id = p.teacher_id) || ': بقي '
          || (r->>'below') || ' من طلاب الخطة دون 60% بعد الخطة العلاجية الثانية.',
        'general', '/improve?tab=board', null, boss, null, null, true);
    end if;
  end if;
  return r;
end; $$;

revoke execute on function public.quiz_plan_measure(uuid, text) from public, anon;
grant  execute on function public.quiz_plan_measure(uuid, text) to authenticated;
-- نهاية الجزء 2
