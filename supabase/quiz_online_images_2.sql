-- =====================================================================
-- صور الأسئلة والخيارات في الاختبار الإلكتروني (الجزء 2 من 2): get_online_quiz
-- تُرسل للطالب أثناء محاولته مسار صورة كل سؤال وصور خياراته.
-- يُنفَّذ بعد الجزء 1، وتكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.get_online_quiz(p_quiz uuid)
returns jsonb language plpgsql security definer set search_path = public as $function$
declare
  a   public.quiz_assignments%rowtype;
  o   public.quiz_online%rowtype;
  qz  public.quizzes%rowtype;
  v_state text;
  v_qs jsonb := null;
  v_res jsonb := null;
begin
  select a2.* into a from quiz_assignments a2 join students s on s.id = a2.student_id
   where a2.quiz_id = p_quiz and s.user_id = auth.uid();
  if a.id is null then return jsonb_build_object('state', 'not_assigned'); end if;

  -- محاولة انتهى وقتها ولم تُسلَّم (أُغلق المتصفح مثلًا) ⇒ تُسلَّم بما حُفظ
  if a.submitted_at is null and a.started_at is not null
     and a.deadline_at + interval '1 minute' < now() then
    perform public._finish_online_attempt(a.id, a.draft);
    select * into a from quiz_assignments where id = a.id;
  end if;

  select * into o  from quiz_online where quiz_id = p_quiz;
  select * into qz from quizzes     where id = p_quiz;

  v_state := case
    when a.submitted_at is not null then 'submitted'
    when a.started_at   is not null then 'in_progress'
    when now() < o.opens_at         then 'upcoming'
    when now() >= o.closes_at       then 'closed'
    else 'open' end;

  if v_state = 'in_progress' then
    select jsonb_agg(jsonb_build_object(
             'id', x.id, 'kind', x.kind, 'text', x.text, 'marks', x.marks,
             'options', x.options, 'sort_order', x.sort_order,
             'listening', x.listening, 'image_path', x.image_path,
             'option_images', x.option_images) order by x.sort_order)
      into v_qs from quiz_questions x where x.quiz_id = p_quiz;
  end if;

  if v_state = 'submitted' and o.show_result then
    select jsonb_build_object('score', s.score, 'total', qz.total_marks) into v_res
      from quiz_submissions s where s.quiz_id = p_quiz and s.student_id = a.student_id limit 1;
  end if;

  return jsonb_build_object(
    'state', v_state,
    'now', now(),
    'quiz', jsonb_build_object('id', qz.id, 'title', qz.title, 'subject_name', qz.subject_name,
                               'total_marks', qz.total_marks, 'instructions', qz.instructions,
                               'lang', qz.lang,
                               'listening_audio', case when v_state = 'in_progress' then qz.listening_audio end),
    'online', jsonb_build_object('opens_at', o.opens_at, 'closes_at', o.closes_at,
                                 'duration_min', o.duration_min, 'show_result', o.show_result),
    'attempt', jsonb_build_object('started_at', a.started_at, 'deadline_at', a.deadline_at,
                                  'submitted_at', a.submitted_at,
                                  'draft', case when v_state = 'in_progress' then a.draft end),
    'questions', v_qs,
    'result', v_res);
end $function$;

-- نهاية الجزء 2
