-- حلقة التحسين (الجزء 5 من 5): قسم «أثر التطوير» في ملف المعلم الرقمي.
-- • improve_impact: البنود التي تحسّنت بعد خطة تطوير متابَعة هذا العام (من درجة إلى درجة)،
--   والخطط العلاجية في دورة الاختبار التي ارتفع متوسط طلابها في اختبار التحقق (quiz_verify_*).
--   لا يعرض ما لم يتحسّن ولا نص التوصية ولا أسماء الطلاب، فالملف واجهة يراها الزائر.
-- • تستدعيها dfile_data (teacher_dfile_3) وdfile_public (teacher_dfile_5) إن وُجدت، فلا يهم ترتيب التنفيذ.
-- يُنفَّذ بعد الجزء 1 وبعد quiz_verify_1. تكرار التنفيذ آمن.

-- أعمدة quiz_plans (round وimpact وmeasured_at) من quiz_verify_1. إعداد الموقع التجريبي يرتّب الملفات
-- بتاريخ آخر commit، ولهذا الملف وquiz_verify_1 التاريخ نفسه فيسبقه أبجديًا. لذلك لا يُفحص متن الدالة
-- عند إنشائها، كما في schema.sql، وتعمل بعد تنفيذ quiz_verify_1 أيًّا كان الترتيب.
set check_function_bodies = off;

create or replace function public.improve_impact(p_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with y as (select coalesce((select value from public.settings where key = 'active_year'), '') v)
  select coalesce(jsonb_agg(x order by at desc), '[]'::jsonb) from (
    select g.closed_at at, jsonb_build_object('el', g.element_key, 'from', g.baseline, 'to', g.result_score,
             'at', g.closed_at, 'cycle', g.cycle, 'src', g.source) x
      from public.improvement_goals g, y
     where g.teacher_user_id = p_uid and g.status = 'closed' and g.improved and coalesce(g.academic_year, '') = y.v
    union all
    select p.measured_at, jsonb_build_object('kind', 'quiz', 'title', z.title, 'subject', z.subject_name, 'round', p.round,
             'n', p.impact->'n', 'passed', p.impact->'passed', 'before', p.impact->'before', 'after', p.impact->'after',
             'at', p.measured_at)
      from public.quiz_plans p join public.quizzes z on z.id = p.quiz_id, y
     where z.teacher_id = p_uid and p.kind = 'remedial' and p.measured_at is not null and p.impact ? 'n'
       and (p.impact->>'after')::numeric > (p.impact->>'before')::numeric and coalesce(z.academic_year, y.v) = y.v
  ) t;
$$;

revoke execute on function public.improve_impact(uuid) from public, anon, authenticated;
-- نهاية الجزء 5
