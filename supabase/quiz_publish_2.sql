-- =====================================================================
-- نشر نتائج الاختبارات القصيرة والتغذية الراجعة — الجزء 2 من 2.
-- my_quiz_feedback: إحصائيات اختبار واحد للطالب حين يتيحها المعلم:
--   درجته، ومتوسط فصله وأعلى درجة وأدناها، وحال كل فقرة مصحَّحة آليًا
--   (صحيحة 1، جزئية بين 0 و1، خاطئة 0، لم يُجب null) ونسبة إجابة الفصل لها.
-- لا تُرسل مفاتيح الإجابة. يُنفَّذ بعد الجزء 1. تكرار التنفيذ آمن.
-- =====================================================================

-- نسبة صحة إجابة فقرة مصحَّحة آليًا (مثل grade_submission)
create or replace function public._quiz_item_fraction(p_kind text, p_key jsonb, p_given jsonb)
returns numeric language sql immutable as $$
  select case
    when p_given is null or p_given = 'null'::jsonb then 0
    when p_kind in ('mcq', 'truefalse') then
      (lower(trim(both '"' from p_given::text)) = lower(trim(both '"' from p_key::text)))::int
    when p_kind = 'match' and jsonb_typeof(p_key) = 'object' and jsonb_typeof(p_given) = 'object' then
      (select count(*) filter (where p_given ->> k.key = k.value)::numeric / nullif(count(*), 0)
         from jsonb_each_text(p_key) k)
    else 0 end;
$$;

create or replace function public.my_quiz_feedback(p_student uuid, p_quiz uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q quizzes%rowtype; me quiz_submissions%rowtype; v jsonb; items jsonb;
begin
  select * into q from quizzes where id = p_quiz;
  select * into me from quiz_submissions where quiz_id = p_quiz and student_id = p_student limit 1;
  if q.id is null or me.id is null or not public.can_read_student(p_student) then
    raise exception 'غير مصرّح';
  end if;
  if not q.feedback_enabled or not q.results_published then
    raise exception 'لم يُتح المعلم التغذية الراجعة لهذا الاختبار';
  end if;

  -- زملاء الفصل الذين أدّوا الاختبار (أو كل من أدّاه إن لم يُعرف الفصل)
  with peers as (
    select * from quiz_submissions s
     where s.quiz_id = p_quiz and not s.absent and s.score is not null
       and (me.class_id is null or s.class_id is not distinct from me.class_id)
  )
  select jsonb_build_object(
      'count', count(*), 'avg', round(avg(score), 2), 'max', max(score), 'min', min(score),
      'absent', (select count(*) from quiz_submissions s where s.quiz_id = p_quiz and s.absent
                  and (me.class_id is null or s.class_id is not distinct from me.class_id)))
    into v from peers;

  select coalesce(jsonb_agg(jsonb_build_object(
           'n', x.n, 'kind', x.kind, 'marks', x.marks, 'text', left(x.text, 160),
           'mine', x.mine, 'class', x.cls) order by x.n), '[]'::jsonb)
    into items
    from (
      select row_number() over (order by qq.sort_order, qq.created_at) as n,
             qq.kind, qq.marks, qq.text,
             case when qq.kind not in ('mcq', 'truefalse', 'match') or me.absent then null
                  when me.answers ? qq.id::text
                    then round(public._quiz_item_fraction(qq.kind, qq.answer, me.answers -> qq.id::text), 2)
             end as mine,
             case when qq.kind in ('mcq', 'truefalse', 'match') then
               (select round(100 * avg(public._quiz_item_fraction(qq.kind, qq.answer, s.answers -> qq.id::text)))
                  from quiz_submissions s
                 where s.quiz_id = p_quiz and not s.absent and s.answers <> '{}'::jsonb
                   and (me.class_id is null or s.class_id is not distinct from me.class_id))
             end as cls
        from quiz_questions qq where qq.quiz_id = p_quiz
    ) x;

  return jsonb_build_object(
    'title', q.title, 'subject', q.subject_name, 'period', q.period, 'mode', q.mode,
    'exam_date', q.exam_date, 'total', q.total_marks,
    'score', me.score, 'absent', me.absent, 'answered', me.answers <> '{}'::jsonb,
    'peers', v, 'items', items);
end $$;

revoke execute on function public.my_quiz_feedback(uuid, uuid) from public, anon;
grant  execute on function public.my_quiz_feedback(uuid, uuid) to authenticated;
-- نهاية الجزء 2
