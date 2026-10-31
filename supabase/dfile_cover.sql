-- =====================================================================
-- ملف المعلم الرقمي: تغطية بنود كل عنصر بدل جمع أعداد شواهدها. العمل الواحد (كالاختبار) يشهد
-- لأكثر من بند، فكان جمع الأعداد يضخّم العنصر (اختباران ظهرا 5 شواهد). dfile_item_cover:
-- لكل عنصر { on: بنود لها شاهد (آلي أو مرفوع)، of: بنوده كلها }، ويضيفها dfile_extra باسم evidence_cover.
-- يُنفَّذ بعد teacher_dfile_8.sql وperf_auto_core_1.sql. تكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.dfile_item_cover(p_uid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare y text := (select value from settings where key = 'active_year'); ks text[]; k2 text[];
begin
  select array_agg(distinct k) into ks from (
    select c.item_key k from perf_auto_counts_core(p_uid, y) c where c.cnt > 0
    union select e.item_key from perf_evidence e where e.teacher_user_id = p_uid and e.academic_year = y) z;
  if to_regprocedure('public.perf_qbank_core(uuid, text)') is not null then
    execute 'select array_agg(item_key) from public.perf_qbank_core($1, $2) where cnt > 0' into k2 using p_uid, y;
    ks := coalesce(ks, '{}') || coalesce(k2, '{}');
  end if;
  return (select coalesce(jsonb_object_agg(el.key, jsonb_build_object(
            'on', (select count(*) from perf_items i where i.element_key = el.key and i.is_active and i.key = any(coalesce(ks, '{}'))),
            'of', (select count(*) from perf_items i where i.element_key = el.key and i.is_active))), '{}'::jsonb)
          from perf_elements el where not el.evaluator_only);
end; $$;
revoke execute on function public.dfile_item_cover(uuid) from public, anon, authenticated;

-- إضافات التقرير (من teacher_dfile_8.sql) ومعها evidence_cover
create or replace function public.dfile_extra(p_uid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare i jsonb; a jsonb;
begin
  if to_regprocedure('public.improve_impact(uuid)') is not null then execute 'select public.improve_impact($1)' into i using p_uid; end if;
  if to_regprocedure('public.dfile_auto_evidence(uuid)') is not null then execute 'select public.dfile_auto_evidence($1)' into a using p_uid; end if;
  return jsonb_build_object('impact', coalesce(i, '[]'::jsonb), 'evidence_auto', coalesce(a, '{}'::jsonb),
                            'records', public.dfile_records(p_uid), 'evidence_cover', public.dfile_item_cover(p_uid));
end; $$;
revoke execute on function public.dfile_extra(uuid) from public, anon, authenticated;

-- نهاية الجزء 1
