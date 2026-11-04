-- =====================================================================
-- سجل المناوبة اليومية (2 من 2): تنبيه أولياء أمور الطلاب المتأخرين عند اعتماد الوكيل، في حساباتهم بالبوابة
-- وعلى الجوال، والمناوبة في شواهد الأداء (e01_06 «الالتزام بالمناوبة اليومية»). يُنفَّذ بعد duty_log_1.sql
-- وsupervision_perf.sql. تكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.duty_notify_lates(p_date date, p_lates jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare x jsonb; nid uuid; n int := 0; uids uuid[];
begin
  for x in select * from jsonb_array_elements(p_lates) loop
    select array_agg(distinct g.user_id) into uids from guardian_student gs join guardians g on g.id = gs.guardian_id
     where gs.student_id = nullif(x ->> 'student_id', '')::uuid and g.user_id is not null;
    continue when uids is null;
    insert into notifications (title, body, kind, is_auto, created_by, sender_name)
    values ('تنبيه تأخر: ' || coalesce(x ->> 'name', 'ابنكم'),
            'سُجّل في المناوبة تأخر ابنكم ' || coalesce(x ->> 'name', '') ||
            case x ->> 'kind' when 'morning' then ' في الحضور الصباحي' else ' في الانصراف (الاستلام)' end ||
            ' يوم ' || to_char(p_date, 'DD/MM/YYYY') || coalesce(' الساعة ' || nullif(x ->> 'time', ''), '') ||
            coalesce('، والسبب: ' || nullif(x ->> 'reason', ''), '') ||
            '. بقاء الطالب في المدرسة بعد الانصراف يضرّه ويعرّضه للخطر ويرهقه، فنرجو الحرص على استلامه في موعده.',
            'general', true, auth.uid(), 'المناوبة اليومية')
    returning id into nid;
    insert into notification_recipients (notification_id, user_id)
    select nid, u from unnest(uids) u join users on users.id = u and users.is_active on conflict do nothing;
    begin perform public.push_notification(nid); exception when others then null; end;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.duty_notify_lates(date, jsonb) from public, anon, authenticated;

-- شواهد الأداء: أيام الإشراف (supervision_perf.sql) مع أيام المناوبة المعتمدة التي حضرها المناوب
create or replace function public.sup_perf_rows(p_uid uuid, y0 date)
returns table (uid uuid, item text, d date, detail text)
language sql stable security definer set search_path = public as $$
  select (m ->> 'user_id')::uuid, 'e01_06', l.log_date,
         'عضو في الإشراف اليومي · ' || case m ->> 'status' when 'late' then 'متأخر' else 'حاضر' end
    from supervision_log l cross join lateral jsonb_array_elements(l.members) m
   where l.status = 'approved' and l.log_date >= y0 and m ->> 'status' in ('present', 'late')
     and coalesce(m ->> 'user_id', '') <> '' and (p_uid is null or m ->> 'user_id' = p_uid::text)
  union all
  select l.supervisor_id, 'e01_06', l.log_date, 'المشرف المتابع للإشراف اليومي'
    from supervision_log l where l.status = 'approved' and l.log_date >= y0 and (p_uid is null or l.supervisor_id = p_uid)
  union all
  select (m ->> 'user_id')::uuid, 'e01_06', l.duty_date,
         'المناوبة اليومية · ' || case m ->> 'status' when 'late' then 'متأخر' else 'حاضر' end
    from duty_log l cross join lateral jsonb_array_elements(l.members) m
   where l.status = 'approved' and l.duty_date >= y0 and m ->> 'status' in ('present', 'late')
     and coalesce(m ->> 'user_id', '') <> '' and (p_uid is null or m ->> 'user_id' = p_uid::text)
  union all
  select ar.user_id, 'd06_06', l.log_date,
         'سجل إشراف معتمد · ' || coalesce(l.supervisor_name, '') || ' · غائب ' ||
         (select count(*) from jsonb_array_elements(l.members) x where x ->> 'status' = 'absent')
    from supervision_log l join admin_roles ar on ar.role_type::text in ('deputy_academic', 'deputy_school')
   where l.status = 'approved' and l.log_date >= y0 and (p_uid is null or ar.user_id = p_uid);
$$;
revoke all on function public.sup_perf_rows(uuid, date) from public, anon, authenticated;
-- نهاية الجزء 2
