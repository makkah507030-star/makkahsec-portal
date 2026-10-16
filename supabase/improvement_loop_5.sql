-- حلقة التحسين (الجزء 5 من 5): قسم «أثر التطوير» في ملف المعلم الرقمي.
-- • improve_impact: البنود التي تحسّنت بعد خطة تطوير متابَعة هذا العام (من درجة إلى درجة).
--   لا يعرض ما لم يتحسّن ولا نص التوصية، فالملف واجهة يراها الزائر.
-- • تستدعيها dfile_data (teacher_dfile_3) وdfile_public (teacher_dfile_5) إن وُجدت، فلا يهم ترتيب التنفيذ.
-- يُنفَّذ بعد الجزء 1. تكرار التنفيذ آمن.

create or replace function public.improve_impact(p_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('el', g.element_key, 'from', g.baseline, 'to', g.result_score,
           'at', g.closed_at, 'cycle', g.cycle, 'src', g.source) order by g.closed_at desc), '[]'::jsonb)
    from public.improvement_goals g
   where g.teacher_user_id = p_uid and g.status = 'closed' and g.improved
     and coalesce(g.academic_year, '') = coalesce((select value from public.settings where key = 'active_year'), '');
$$;

revoke execute on function public.improve_impact(uuid) from public, anon, authenticated;
-- نهاية الجزء 5
