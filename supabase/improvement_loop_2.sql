-- حلقة التحسين (الجزء 2 من 5): قياس الأثر وإنشاء التوصيات من زيارة أو تقييم صدر للمعلم.
-- improve_apply داخلية تستدعيها المحفّزات (الجزء 3) فقط:
-- 1) القياس: كل خطة معتمدة (active) للمعلم قُدِّر بندها في هذا المصدر تُغلق بدرجته مقابل خط الأساس.
--    تحسّن = الدرجة أعلى من خط الأساس (وبلا خط أساس: 4 فأعلى). وما لم يتحسّن تُفتح له دورة تالية بدعم أعلى.
-- 2) الإنشاء: التوصيات المؤكدة (on) ببندها ونصها، ولا تُكرر توصية لبند له توصية مفتوحة.
-- يُنفَّذ بعد الجزء 1. تكرار التنفيذ آمن.

create or replace function public.improve_apply(p_teacher uuid, p_owner uuid, p_source text, p_source_id uuid,
                                                p_scores jsonb, p_items jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  g public.improvement_goals;
  it jsonb;
  sc int;
  k text;
  y text := (select value from public.settings where key = 'active_year');
  n int;
  made int := 0;
  again int := 0;
  closed int := 0;
  boss uuid[] := (select array_agg(user_id) from public.admin_roles where role_type::text = 'principal');
begin
  for g in select * from public.improvement_goals
            where teacher_user_id = p_teacher and status = 'active' and source_id <> p_source_id
              and p_scores ? element_key for update loop
    sc := (p_scores->>g.element_key)::int;
    update public.improvement_goals
       set status = 'closed', result_score = sc, result_source = p_source, result_source_id = p_source_id,
           improved = sc > coalesce(g.baseline, 3), closed_at = now(), updated_at = now()
     where id = g.id;
    closed := closed + 1;
    if sc <= coalesce(g.baseline, 3) then
      insert into public.improvement_goals (teacher_user_id, owner_user_id, academic_year, source, source_id,
             element_key, baseline, recommendation, cycle, parent_id)
      values (p_teacher, coalesce(g.owner_user_id, p_owner), y, p_source, p_source_id,
              g.element_key, sc, g.recommendation, g.cycle + 1, g.id)
      on conflict (source_id, element_key) do nothing;
      get diagnostics n = row_count;
      again := again + n;
    end if;
  end loop;

  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    k := it->>'key';
    continue when coalesce((it->>'on')::boolean, false) is not true or coalesce(k, '') !~ '^e(0[1-9]|1[01])$'
               or nullif(trim(coalesce(it->>'text', '')), '') is null;
    continue when exists (select 1 from public.improvement_goals where teacher_user_id = p_teacher
                           and element_key = k and status in ('plan', 'review', 'active'));
    insert into public.improvement_goals (teacher_user_id, owner_user_id, academic_year, source, source_id,
           element_key, baseline, recommendation)
    values (p_teacher, p_owner, y, p_source, p_source_id, k,
            case when (p_scores->>k) ~ '^[1-5]$' then (p_scores->>k)::int end, left(trim(it->>'text'), 1000))
    on conflict (source_id, element_key) do nothing;
    get diagnostics n = row_count;
    made := made + n;
  end loop;

  if closed > 0 then
    perform public.send_notification('قيس أثر خطة التطوير',
      'البنود التي تحسّنت بعد خطتك: ' || (closed - again) || ' من ' || closed
        || case when again > 0 then '، وفُتحت دورة ثانية بدعم أعلى لما لم يتحسّن.' else '.' end,
      'general', '/improve', null, array[p_teacher], null, null, true);
  end if;
  if made + again > 0 then
    perform public.send_notification('توصيات تطوير تنتظر خطتك',
      'توصيات تطوير جديدة: ' || (made + again) || '. اكتب خطتك لكل منها وموعد المتابعة.',
      'general', '/improve', null, array[p_teacher], null, null, true);
  end if;
  if again > 0 and boss is not null then
    perform public.send_notification('دورة تطوير ثانية بدعم أعلى',
      (select coalesce(full_name, 'معلم') from public.users where id = p_teacher)
        || ': لم يتحسّن ' || again || ' من البنود بعد خطة التطوير، وفُتحت لها دورة ثانية.',
      'general', '/improve?tab=board', null, boss, null, null, true);
  end if;
end; $$;

revoke execute on function public.improve_apply(uuid, uuid, text, uuid, jsonb, jsonb) from public, anon, authenticated;
-- نهاية الجزء 2
