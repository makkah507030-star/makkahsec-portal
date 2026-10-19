-- =====================================================================
-- الاختبار دون إنترنت (الجزء 3 من 4): مسح رمز التسليم
-- الرمز: MKQ1.الإسناد.الإصدار.الإجابات.مرات المغادرة.الدقائق.التوقيع
-- الإجابات بترتيب الحزمة مفصولة بـ _ : رقم الخيار (0-9 ثم a-z) أو t/f، والمزاوجة حرف لكل
-- فقرة (- بلا إجابة)، والفارغ بلا إجابة. التوقيع HMAC-SHA256 برمز الطالب (أول 16 خانة).
-- يُنفَّذ بعد الجزأين 1 و2، وتكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.quiz_offline_scan(p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t text := regexp_replace(trim(p_text), '^.*/', '');
  p text[]; a quiz_assignments%rowtype; o quiz_offline%rowtype; qz quizzes%rowtype;
  v_name text; v_items text[]; v_ans jsonb := '{}'::jsonb; q record; it text;
  v_m jsonb; k int; c text; v_score numeric; b36 constant text := '0123456789abcdefghijklmnopqrstuvwxyz';
begin
  p := string_to_array(t, '.');
  if array_length(p, 1) <> 7 or p[1] <> 'MKQ1' then raise exception 'ليس رمز تسليم اختبار'; end if;
  select * into a from quiz_assignments where id::text = p[2] for update;
  if a.id is null then raise exception 'رمز غير معروف'; end if;
  select * into qz from quizzes where id = a.quiz_id;
  if qz.teacher_id is distinct from auth.uid() then raise exception 'هذا الاختبار ليس لك'; end if;
  select full_name into v_name from students where id = a.student_id;
  if a.offline_token is null or left(encode(extensions.hmac(
       array_to_string(p[1:6], '.'), a.offline_token, 'sha256'), 'hex'), 16) <> p[7] then
    raise exception 'رمز غير صالح (التوقيع لا يطابق) — %', v_name;
  end if;

  if a.submitted_at is not null then
    return jsonb_build_object('status', 'dup', 'student', v_name, 'title', qz.title, 'total', qz.total_marks,
      'score', (select score from quiz_submissions where quiz_id = a.quiz_id and student_id = a.student_id limit 1));
  end if;
  select * into o from quiz_offline where quiz_id = a.quiz_id;
  if o.quiz_id is null or o.ver::text <> p[3] then
    raise exception 'نسخة الطالب قديمة (أُعيد تجهيز الاختبار بعد تنزيله) — %', v_name;
  end if;

  v_items := string_to_array(p[4], '_');
  for q in select x.id, x.kind, i from unnest(o.qids) with ordinality as u(qid, i)
             join quiz_questions x on x.id = u.qid loop
    it := coalesce(v_items[q.i], '');
    continue when it = '';
    if q.kind = 'truefalse' then
      v_ans := v_ans || jsonb_build_object(q.id::text, case it when 't' then 'true' else 'false' end);
    elsif q.kind = 'match' then
      v_m := '{}'::jsonb;
      for k in 1 .. length(it) loop
        c := substr(it, k, 1);
        if c <> '-' then v_m := v_m || jsonb_build_object((k - 1)::text, (strpos(b36, c) - 1)::text); end if;
      end loop;
      v_ans := v_ans || jsonb_build_object(q.id::text, v_m);
    else
      v_ans := v_ans || jsonb_build_object(q.id::text, (strpos(b36, it) - 1)::text);
    end if;
  end loop;

  update quiz_assignments
     set started_at = coalesce(started_at, now() - make_interval(mins => coalesce(nullif(p[6], '')::int, 0))),
         deadline_at = coalesce(deadline_at, now()),
         offline_info = coalesce(offline_info, '{}'::jsonb) || jsonb_build_object(
           'scanned_at', now(), 'scanned_by', auth.uid(), 'leaves', p[5]::int, 'minutes', p[6]::int)
   where id = a.id;
  v_score := public._finish_online_attempt(a.id, v_ans);

  return jsonb_build_object('status', 'ok', 'student', v_name, 'title', qz.title,
    'score', v_score, 'total', qz.total_marks, 'leaves', p[5]::int, 'minutes', p[6]::int);
end $$;

revoke all on function public.quiz_offline_scan(text) from public, anon;
grant execute on function public.quiz_offline_scan(text) to authenticated;

-- نهاية الجزء 3
