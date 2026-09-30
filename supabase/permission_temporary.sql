-- الاستئذان المؤقت: يخرج الطالب من وقت ويعود في وقت محدّد. يُحفظ كحصص محددة
-- (الحصص التي يتقاطع وقتها مع مدة الخروج) ليبقى تحضير المعلمين والتقارير كما هي،
-- ومعه وقتا الخروج والعودة للعرض وللإشعار.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.

alter table public.permission_requests add column if not exists start_time  time;
alter table public.permission_requests add column if not exists return_time time;

-- إشعار الطالب وولي أمره: «استئذان مؤقت من 09:30 حتى 10:45» بدل أرقام الحصص
CREATE OR REPLACE FUNCTION public.notify_permission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_req    record;
  v_name   text;
  v_body   text;
  v_ids    uuid[];
begin
  select request_date, scope, period_numbers, note, start_time, return_time
  into v_req
  from permission_requests where id = new.request_id;

  if v_req is null then return new; end if;

  select full_name into v_name from students where id = new.student_id;

  v_body := coalesce(v_name, 'الطالب') || ' — '
    || case when v_req.scope = 'day' then 'اليوم كاملًا'
            when v_req.return_time is not null then
              'استئذان مؤقت من ' || to_char(v_req.start_time, 'HH24:MI')
              || ' حتى ' || to_char(v_req.return_time, 'HH24:MI')
            else 'الحصص ' || array_to_string(v_req.period_numbers, '، ') end
    || ' بتاريخ ' || to_char(v_req.request_date, 'DD/MM/YYYY')
    || coalesce(' · ' || v_req.note, '');

  select array_remove(array_agg(uid), null) into v_ids
  from (
    select s.user_id as uid from students s where s.id = new.student_id
    union
    select g.user_id
    from guardian_student gs
    join guardians g on g.id = gs.guardian_id
    where gs.student_id = new.student_id
  ) t;

  if v_ids is not null and array_length(v_ids, 1) > 0 then
    perform send_notification(
      'استئذان داخلي', v_body, 'permission', '/',
      null, v_ids, null, null, true
    );
  end if;

  return new;
end $function$
;
