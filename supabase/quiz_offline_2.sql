-- =====================================================================
-- الاختبار دون إنترنت (الجزء 2 من 4): دوال الطالب، ومنع بدئه عبر الإنترنت
-- يُنفَّذ بعد الجزء 1، وتكرار التنفيذ آمن.
-- =====================================================================

-- هل للاختبار نسخة دون إنترنت؟ وهل نزّلها الطالب بإصدارها الحالي؟
create or replace function public.quiz_offline_available(p_quiz uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a quiz_assignments%rowtype; o quiz_offline%rowtype;
begin
  select a2.* into a from quiz_assignments a2 join students s on s.id = a2.student_id
   where a2.quiz_id = p_quiz and s.user_id = auth.uid();
  select * into o from quiz_offline where quiz_id = p_quiz;
  if a.id is null or o.quiz_id is null then
    return jsonb_build_object('available', false,
      'offline', exists (select 1 from quizzes where id = p_quiz and mode = 'offline'));
  end if;
  return jsonb_build_object('available', true, 'offline', true, 'ver', o.ver,
    'downloaded', a.offline_at is not null and (a.offline_info->>'ver')::int = o.ver);
end $$;

-- تنزيل الحزمة المشفّرة مع رمز توقيع خاص بالطالب (المفتاح لا يُرسل أبدًا)
create or replace function public.quiz_offline_download(p_quiz uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a quiz_assignments%rowtype; o quiz_offline%rowtype; qo quiz_online%rowtype;
        qz quizzes%rowtype; v_name text; v_tok text;
begin
  select a2.* into a from quiz_assignments a2 join students s on s.id = a2.student_id
   where a2.quiz_id = p_quiz and s.user_id = auth.uid() for update of a2;
  if a.id is null then raise exception 'الاختبار غير مُسند إليك'; end if;
  if a.submitted_at is not null then raise exception 'سلّمت هذا الاختبار من قبل'; end if;
  select * into o from quiz_offline where quiz_id = p_quiz;
  if o.quiz_id is null then raise exception 'لم يجهّز المعلم نسخة دون إنترنت لهذا الاختبار'; end if;
  select * into qo from quiz_online where quiz_id = p_quiz;
  if now() < qo.opens_at then raise exception 'لم يُتح تنزيل الاختبار بعد'; end if;
  if now() >= qo.closes_at then raise exception 'انتهى وقت هذا الاختبار'; end if;
  select * into qz from quizzes where id = p_quiz;
  select full_name into v_name from students where id = a.student_id;

  v_tok := coalesce(a.offline_token, encode(extensions.gen_random_bytes(16), 'hex'));
  update quiz_assignments
     set offline_token = v_tok, offline_at = now(),
         offline_info = coalesce(offline_info, '{}'::jsonb) || jsonb_build_object('ver', o.ver)
   where id = a.id;

  return jsonb_build_object(
    'quiz_id', p_quiz, 'assignment', a.id, 'token', v_tok, 'ver', o.ver,
    'student_id', a.student_id, 'student', v_name,
    'title', qz.title, 'subject', qz.subject_name, 'total', qz.total_marks,
    'lang', qz.lang, 'instructions', qz.instructions,
    'duration_min', qo.duration_min, 'closes_at', qo.closes_at,
    'package', o.package, 'downloaded_at', now());
end $$;

-- الاختبار دون إنترنت لا يُبدأ من البوابة (فتظهر أسئلته قبل الحصة)؛ بقية الدالة كما هي
create or replace function public.start_online_quiz(p_quiz uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a quiz_assignments%rowtype; o quiz_online%rowtype;
begin
  select a2.* into a from quiz_assignments a2 join students s on s.id = a2.student_id
   where a2.quiz_id = p_quiz and s.user_id = auth.uid() for update of a2;
  if a.id is null then raise exception 'الاختبار غير مُسند إليك'; end if;
  if exists (select 1 from quizzes where id = p_quiz and mode = 'offline') then
    raise exception 'هذا الاختبار يؤدّى دون إنترنت في الفصل — نزّله من صفحته';
  end if;
  select * into o from quiz_online where quiz_id = p_quiz;
  if a.started_at is null then
    if now() < o.opens_at  then raise exception 'لم يُفتح الاختبار بعد'; end if;
    if now() >= o.closes_at then raise exception 'انتهى وقت الاختبار'; end if;
    update quiz_assignments
       set started_at = now(),
           deadline_at = least(now() + make_interval(mins => o.duration_min), o.closes_at)
     where id = a.id;
  end if;
  return public.get_online_quiz(p_quiz);
end $$;

revoke all on function public.quiz_offline_available(uuid) from public, anon;
revoke all on function public.quiz_offline_download(uuid) from public, anon;
grant execute on function public.quiz_offline_available(uuid) to authenticated;
grant execute on function public.quiz_offline_download(uuid) to authenticated;

-- نهاية الجزء 2
