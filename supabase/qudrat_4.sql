-- =====================================================================
-- مركز التدريب — القدرات (الدفعة الثالثة، الجزء 2 من 2): الرد، ولوحة الإدارة
-- يلزم قبله qudrat_1 و qudrat_2 و qudrat_3. تكرار التنفيذ آمن.
-- =====================================================================

-- رد المعلم المسند إليه السؤال، أو الإدارة (المدير ووكيل الشؤون التعليمية والدعم الفني)
create or replace function public.qudrat_reply(p_id uuid, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
declare a public.qudrat_asks; nid uuid;
begin
  select * into a from qudrat_asks where id = p_id;
  if a.id is null then raise exception 'السؤال غير موجود'; end if;
  if not coalesce(a.teacher_id = current_teacher_id() or qudrat_manager(), false) then raise exception 'ليس لك الرد على هذا السؤال'; end if;
  if length(trim(coalesce(p_reply, ''))) < 2 then raise exception 'اكتب الرد'; end if;
  update qudrat_asks set reply = trim(p_reply), replied_by = auth.uid(), replied_at = now(), seen = false where id = p_id;
  nid := send_notification('رد معلمك على سؤالك في مركز التدريب', left(trim(p_reply), 140),
                           'general', '/qudrat', null, array[a.student_user], null, null, true);
  begin perform push_notification(nid); exception when others then null; end;
end $$;

-- اطلاع الطالب على ردود أسئلته
create or replace function public.qudrat_seen()
returns void language sql security definer set search_path = public as $$
  update qudrat_asks set seen = true where student_user = auth.uid() and reply is not null and not seen;
$$;

-- لوحة الإدارة: كل متدرب بنشاطه ومستواه وآخر محاكاة وموعد اختباره
create or replace function public.qudrat_admin_students()
returns table (user_id uuid, full_name text, grade int, class_no int, answers int, correct int,
               last_at timestamptz, mocks int, best_mock int, last_mock int, exam_date date, asks int)
language sql stable security definer set search_path = public as $$
  with a as (
    select user_id, count(*)::int n, count(*) filter (where correct)::int c, max(created_at) last_at
    from qudrat_answers group by user_id
  ), m as (
    select user_id, count(*)::int n, max(round(correct * 100.0 / total))::int best,
           (array_agg(round(correct * 100.0 / total)::int order by created_at desc))[1] last
    from qudrat_mocks group by user_id
  )
  select a.user_id, s.full_name, v.grade::int, v.class_no::int, a.n, a.c, a.last_at, coalesce(m.n, 0), m.best, m.last,
         p.exam_date, (select count(*)::int from qudrat_asks k where k.student_user = a.user_id)
  from a
  left join students s on s.user_id = a.user_id
  left join lateral (select x.grade, x.class_no from v_active_students x where x.student_id = s.id and x.status = 'active'
                     order by x.academic_year desc limit 1) v on true
  left join m on m.user_id = a.user_id
  left join qudrat_plans p on p.user_id = a.user_id
  where qudrat_manager();
$$;

-- لوحة الإدارة: مستوى المدرسة في كل مهارة
create or replace function public.qudrat_admin_skills()
returns table (sec text, skill text, answers int, correct int, users int)
language sql stable security definer set search_path = public as $$
  select sec, skill, count(*)::int, count(*) filter (where correct)::int, count(distinct user_id)::int
  from qudrat_answers where qudrat_manager() group by sec, skill;
$$;

revoke all on function public.qudrat_reply(uuid, text) from public, anon;
revoke all on function public.qudrat_seen() from public, anon;
revoke all on function public.qudrat_admin_students() from public, anon;
revoke all on function public.qudrat_admin_skills() from public, anon;
grant execute on function public.qudrat_reply(uuid, text) to authenticated;
grant execute on function public.qudrat_seen() to authenticated;
grant execute on function public.qudrat_admin_students() to authenticated;
grant execute on function public.qudrat_admin_skills() to authenticated;

-- نهاية الجزء 2
