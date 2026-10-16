-- حلقة التحسين (الجزء 5 من 5): قسم «أثر التطوير» في ملف المعلم الرقمي.
-- • improve_impact: البنود التي تحسّنت بعد خطة تطوير متابَعة هذا العام (من درجة إلى درجة).
--   لا يعرض ما لم يتحسّن ولا نص التوصية، فالملف واجهة يراها الزائر.
-- • dfile_data وdfile_public كما في teacher_dfile_3 و5، ويُضاف إليهما impact.
-- يُنفَّذ بعد الأجزاء 1 إلى 4 وبعد ملفات teacher_dfile_*. وإن أُعيد تنفيذ teacher_dfile_3 أو 5 يُعاد هذا بعدهما.

create or replace function public.improve_impact(p_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('el', g.element_key, 'from', g.baseline, 'to', g.result_score,
           'at', g.closed_at, 'cycle', g.cycle, 'src', g.source) order by g.closed_at desc), '[]'::jsonb)
    from public.improvement_goals g
   where g.teacher_user_id = p_uid and g.status = 'closed' and g.improved
     and coalesce(g.academic_year, '') = coalesce((select value from public.settings where key = 'active_year'), '');
$$;

revoke execute on function public.improve_impact(uuid) from public, anon, authenticated;

create or replace function public.dfile_data(p_uid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if p_uid is distinct from auth.uid() and not public.has_admin_role(array['principal', 'tech_support']) then
    raise exception 'غير مصرّح';
  end if;
  return public.dfile_data_core(p_uid) || jsonb_build_object('impact', public.improve_impact(p_uid));
end; $$;

revoke execute on function public.dfile_data(uuid) from public, anon;
grant  execute on function public.dfile_data(uuid) to authenticated;

create or replace function public.dfile_public(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f public.teacher_dfiles;
begin
  select d.* into f from public.teacher_dfiles d join public.users u on u.id = d.teacher_user_id
   where d.code = upper(trim(p_code)) and d.disabled_at is null and u.is_active;
  if not found then return jsonb_build_object('status', 'off'); end if;
  return jsonb_build_object('status', 'ok',
    'settings', jsonb_build_object('code', f.code, 'color', f.color, 'hidden', f.hidden, 'sentences', f.sentences,
      'appoint_year', f.appoint_year, 'perf_rating', f.perf_rating, 'perf_year', f.perf_year, 'rank', f.rank,
      'other_wins', f.other_wins, 'madrasati', f.madrasati, 'activities', f.activities, 'distribution', f.distribution),
    'data', public.dfile_data_core(f.teacher_user_id) || jsonb_build_object('impact', public.improve_impact(f.teacher_user_id)));
end; $$;

revoke execute on function public.dfile_public(text) from public;
grant  execute on function public.dfile_public(text) to anon, authenticated;
-- نهاية الجزء 5
