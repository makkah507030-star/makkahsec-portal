-- =====================================================================
-- الاختبار دون إنترنت (الجزء 4 من 4): نص إشعار النشر. publish_online_quiz كما هي،
-- وللنوع «دون إنترنت» عنوان ونص يطلبان تنزيل الاختبار قبل الحصة. تكرار التنفيذ آمن.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.publish_online_quiz(p_quiz uuid, p_students uuid[], p_opens timestamp with time zone, p_closes timestamp with time zone, p_duration integer, p_show_result boolean, p_renotify boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  qz      public.quizzes%rowtype;
  v_new   uuid[];
  v_users uuid[];
  v_nid   uuid;
  v_body  text;
  v_first boolean;
begin
  select * into qz from quizzes where id = p_quiz;
  if qz.id is null or qz.teacher_id <> auth.uid() then
    raise exception 'غير مصرّح: الاختبار ليس لك';
  end if;
  if not exists (select 1 from quiz_questions where quiz_id = p_quiz) then
    raise exception 'لا توجد أسئلة في الاختبار';
  end if;
  if p_closes <= p_opens then raise exception 'موعد الإغلاق يجب أن يكون بعد موعد الفتح'; end if;
  if p_closes <= now() then raise exception 'موعد الإغلاق مضى'; end if;
  v_first := not exists (select 1 from quiz_online where quiz_id = p_quiz);
  insert into quiz_online (quiz_id, opens_at, closes_at, duration_min, show_result)
  values (p_quiz, p_opens, p_closes, greatest(1, coalesce(p_duration, 15)), coalesce(p_show_result, true))
  on conflict (quiz_id) do update
     set opens_at = excluded.opens_at, closes_at = excluded.closes_at,
         duration_min = excluded.duration_min, show_result = excluded.show_result;
  -- إزالة من لم يبدأ ولم يعد ضمن القائمة
  delete from quiz_assignments
   where quiz_id = p_quiz and started_at is null
     and not (student_id = any(coalesce(p_students, '{}')));
  -- إضافة الجدد — بشرط أن يكونوا طلابًا نشطين في فصل مُسند إليه الاختبار
  with ins as (
    insert into quiz_assignments (quiz_id, student_id, class_id)
    select distinct on (e.student_id) p_quiz, e.student_id, e.class_id
      from student_enrollment e
      join quiz_classes qc on qc.class_id = e.class_id and qc.quiz_id = p_quiz
     where e.status = 'active' and e.student_id = any(coalesce(p_students, '{}'))
    on conflict (quiz_id, student_id) do nothing
    returning student_id
  )
  select array_agg(student_id) into v_new from ins;
  if qz.status = 'draft' then update quizzes set status = 'ready' where id = p_quiz; end if;
  -- من يُشعَر
  select array_agg(distinct s.user_id) into v_users
    from quiz_assignments a join students s on s.id = a.student_id
   where a.quiz_id = p_quiz and s.user_id is not null and a.submitted_at is null
     and (a.student_id = any(coalesce(v_new, '{}')) or p_renotify);
  if v_users is null or array_length(v_users, 1) is null then return 0; end if;
  v_body := coalesce(qz.subject_name || ' — ', '') || case when qz.mode = 'offline' then
            'نزّل الاختبار على جوالك وأنت متصل بالإنترنت قبل حصة الاختبار (آخر موعد ' ||
            to_char(p_closes at time zone 'Asia/Riyadh', 'YYYY/MM/DD') || ')، وفي الحصة افتح makkahsec.com/offline-quiz دون إنترنت وأدِّه بمفتاح يعرضه معلمك.'
            else 'متاح من ' || to_char(p_opens at time zone 'Asia/Riyadh', 'YYYY/MM/DD HH12:MI') ||
            case when to_char(p_opens at time zone 'Asia/Riyadh', 'AM') = 'AM' then ' ص' else ' م' end ||
            ' حتى ' || to_char(p_closes at time zone 'Asia/Riyadh', 'YYYY/MM/DD HH12:MI') ||
            case when to_char(p_closes at time zone 'Asia/Riyadh', 'AM') = 'AM' then ' ص' else ' م' end ||
            '، والمدة ' || greatest(1, coalesce(p_duration, 15)) || ' دقيقة تبدأ من لحظة دخولك. ' ||
            'افتح الرابط وابدأ حين تكون مستعدًا، ويُسلَّم تلقائيًا عند انتهاء الوقت.' end;
  v_nid := public.send_notification(
    p_title    := case when v_first or not p_renotify then '' else 'تذكير — ' end ||
                  case when qz.mode = 'offline' then 'اختبار دون إنترنت: ' else 'اختبار إلكتروني: ' end || qz.title,
    p_body     := v_body,
    p_kind     := 'quiz',
    p_link     := '/quiz/' || p_quiz,
    p_user_ids := v_users,
    p_is_auto  := true);
  if v_nid is not null then
    begin
      update notifications
         set sender_name = coalesce((select full_name from users where id = auth.uid()), sender_name)
       where id = v_nid;
    exception when others then null;
    end;
    perform public.push_notification(v_nid);
    update quiz_assignments a set notified_at = now()
      from students s
     where a.quiz_id = p_quiz and s.id = a.student_id and s.user_id = any(v_users);
  end if;
  return array_length(v_users, 1);
end $function$
;

-- نهاية الجزء 4
