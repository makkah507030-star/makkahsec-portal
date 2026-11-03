-- =====================================================================
-- تحصين الإشعارات (مراجعة أمنية 3 نوفمبر 2026): الإشعار «التلقائي» كان يُقبل من أي حساب لأي فئة وبأي رابط،
-- فيستطيع طالب إرسال إشعار يبدو رسميًا لكل الطلاب أو المعلمين برابط تصيّد خارجي.
-- الآن، للحساب غير الإداري: الإشعار التلقائي لمستخدمين محددين فقط (لا فئات ولا صفوف)، ورابطه داخل البوابة
-- (يبدأ بـ /) أو بلا رابط. الإداري والعمليات الخلفية كما كانت. كل استخدامات البوابة الحالية توافق هذا.
-- يحل محل send_notification بالنسخة نفسها المرسلة من قاعدة الإنتاج مع الشرط الجديد. تكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.send_notification(p_title text, p_body text default null::text, p_kind text default 'general'::text,
  p_link text default null::text, p_roles text[] default null::text[], p_user_ids uuid[] default null::uuid[],
  p_grade integer default null::integer, p_class_no integer default null::integer, p_is_auto boolean default false)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare
  v_id uuid;
  v_count int;
  v_admin boolean := exists (select 1 from users where id = auth.uid() and role::text = 'admin' and is_active = true);
begin
  -- إرسال يدوي (لا تلقائي): يُشترط أن يكون المستدعي إداريًا نشِطًا
  if not p_is_auto and not v_admin then
    raise exception 'not authorized to send notifications';
  end if;
  -- التلقائي من حساب غير إداري: لمستخدمين محددين، وبرابط داخلي
  if p_is_auto and auth.uid() is not null and not v_admin then
    if coalesce(cardinality(p_roles), 0) > 0 or p_grade is not null or p_class_no is not null then
      raise exception 'الإشعار التلقائي لمستخدمين محددين فقط';
    end if;
    if p_link is not null and (p_link !~ '^/' or p_link ~ '^//' or p_link ~ '\\') then
      raise exception 'رابط الإشعار داخل البوابة فقط';
    end if;
  end if;

  insert into notifications (title, body, kind, link, is_auto, created_by)
  values (p_title, p_body, p_kind, p_link, p_is_auto, auth.uid())
  returning id into v_id;

  if p_user_ids is not null and array_length(p_user_ids, 1) > 0 then
    insert into notification_recipients (notification_id, user_id)
    select v_id, u.id from users u where u.id = any(p_user_ids) and u.is_active = true
    on conflict do nothing;
  end if;

  if p_roles is not null and array_length(p_roles, 1) > 0 then
    if p_grade is null and p_class_no is null then
      insert into notification_recipients (notification_id, user_id)
      select v_id, u.id from users u where u.role::text = any(p_roles) and u.is_active = true
      on conflict do nothing;
    else
      if 'student' = any(p_roles) then
        insert into notification_recipients (notification_id, user_id)
        select v_id, s.user_id from v_active_students v join students s on s.id = v.student_id
        where s.user_id is not null and (p_grade is null or v.grade = p_grade) and (p_class_no is null or v.class_no = p_class_no)
        on conflict do nothing;
      end if;
      if 'guardian' = any(p_roles) then
        insert into notification_recipients (notification_id, user_id)
        select v_id, g.user_id from v_active_students v
          join guardian_student gs on gs.student_id = v.student_id join guardians g on g.id = gs.guardian_id
        where g.user_id is not null and (p_grade is null or v.grade = p_grade) and (p_class_no is null or v.class_no = p_class_no)
        on conflict do nothing;
      end if;
      if 'teacher' = any(p_roles) or 'admin' = any(p_roles) then
        insert into notification_recipients (notification_id, user_id)
        select v_id, u.id from users u
        where u.role::text = any(array_remove(array_remove(p_roles, 'student'), 'guardian')) and u.is_active = true
        on conflict do nothing;
      end if;
    end if;
  end if;

  select count(*) into v_count from notification_recipients where notification_id = v_id;
  if v_count = 0 then
    delete from notifications where id = v_id;
    return null;
  end if;
  return v_id;
end $function$;
-- نهاية الجزء 1
