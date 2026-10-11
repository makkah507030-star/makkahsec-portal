-- =====================================================================
-- استمارة توضيح مستوى الطالب — الجزء 3 من 3: تعبئة المعلم، ومراحل الاستمارة، واطلاع ولي الأمر.
-- يُنفَّذ بعد الجزء 2. تكرار التنفيذ آمن.
-- =====================================================================

-- المعلم يعبّئ سطر مادته (ويعدّله) ما دامت الاستمارة عند المعلمين، ويوقّع بتوقيعه المحفوظ
create or replace function public.guidance_inquiry_fill(p_item uuid, p_academic text, p_behavior text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare x record; i record; left_n int;
begin
  select * into x from guidance_inquiry_items where id = p_item;
  if x.id is null or x.teacher_user_id is distinct from auth.uid() then raise exception 'غير مصرّح'; end if;
  select * into i from guidance_inquiries where id = x.inquiry_id;
  if i.status <> 'teachers' then raise exception 'انتقلت الاستمارة من المعلمين، لا يمكن تعديلها الآن'; end if;
  if p_academic not in ('excellent', 'good', 'weak') or p_behavior not in ('excellent', 'good', 'weak') then
    raise exception 'حدّد المستوى التحصيلي والسلوكي';
  end if;
  update guidance_inquiry_items set academic = p_academic, behavior = p_behavior,
         note = nullif(trim(p_note), ''), filled_at = now(),
         sig = (select path from user_signatures where user_id = auth.uid())
   where id = p_item;
  -- اكتملت تعبئة المعلمين (أصحاب الحسابات) ← إشعار الموجه، مرة واحدة عند آخر تعبئة
  select count(*) into left_n from guidance_inquiry_items
   where inquiry_id = i.id and teacher_user_id is not null and filled_at is null;
  if left_n = 0 and x.filled_at is null and i.counselor_id is not null then
    perform public.send_notification('اكتملت تعبئة استمارة المستوى',
      'الطالب ' || i.student_name || ': عبّأ المعلمون كلهم، اكتب رأيك وأرسلها للوكيل.',
      'general', '/inquiry/' || i.id, null, array[i.counselor_id], null, null, true);
  end if;
end $$;

-- p_action: to_deputy (الموجه برأيه) ← deputy (الوكيل برأيه، تعود للموجه) ← send (نسخة لولي الأمر)
create or replace function public.guidance_inquiry_step(p_id uuid, p_action text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare i record; me text; sig text; uids uuid[];
begin
  select * into i from guidance_inquiries where id = p_id;
  if i.id is null then raise exception 'الاستمارة غير موجودة'; end if;
  select full_name into me from users where id = auth.uid();
  select path into sig from user_signatures where user_id = auth.uid();

  if p_action = 'to_deputy' and i.status = 'teachers' and public.guidance_can(i.grade) then
    update guidance_inquiries set status = 'deputy', counselor_note = nullif(trim(p_note), ''),
           counselor_name = me, counselor_sig = sig, counselor_at = now() where id = p_id;
    select array_agg(user_id) into uids from admin_roles where role_type::text = 'deputy_students';
    if uids is not null then
      perform public.send_notification(
        case i.flag when 'urgent' then 'عاجل: ' else '' end || 'استمارة مستوى طالب تنتظر رأيك',
        'الطالب ' || i.student_name || ' — من الموجه الطلابي.', 'general', '/inquiry/' || p_id, null, uids, null, null, true);
    end if;
  elsif p_action = 'deputy' and i.status = 'deputy'
        and public.has_admin_role(array['deputy_students', 'principal', 'tech_support']) then
    update guidance_inquiries set status = 'counselor', deputy_note = nullif(trim(p_note), ''),
           deputy_id = auth.uid(), deputy_name = me, deputy_sig = sig, deputy_at = now() where id = p_id;
    if i.counselor_id is not null then
      perform public.send_notification('عادت استمارة المستوى برأي الوكيل',
        'الطالب ' || i.student_name || ': راجعها وأرسل نسخة لولي الأمر.', 'general', '/inquiry/' || p_id,
        null, array[i.counselor_id], null, null, true);
    end if;
  elsif p_action = 'send' and i.status = 'counselor' and public.guidance_can(i.grade) then
    update guidance_inquiries set status = 'sent', sent_at = now(),
           counselor_note = coalesce(nullif(trim(p_note), ''), counselor_note) where id = p_id;
    select array_agg(g.user_id) into uids from guardian_student gs join guardians g on g.id = gs.guardian_id
     where gs.student_id = i.student_id and g.user_id is not null;
    if uids is not null then
      perform public.send_notification('استمارة مستوى ابنك من التوجيه الطلابي',
        'مستوى ' || i.student_name || ' التحصيلي والسلوكي كما أفاد معلموه، مع رأي الموجه والوكيل.',
        'general', '/inquiry/' || p_id, null, uids, null, null, true);
    end if;
  else
    raise exception 'لا يمكن هذا الإجراء في مرحلة الاستمارة الحالية';
  end if;
end $$;

-- ولي الأمر اطّلع (تختفي من «بانتظار إجرائك»)
create or replace function public.guidance_inquiry_seen(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update guidance_inquiries set guardian_seen_at = now()
   where id = p_id and guardian_seen_at is null and public.gi_guardian(p_id);
$$;

revoke execute on function public.guidance_inquiry_fill(uuid, text, text, text),
  public.guidance_inquiry_step(uuid, text, text), public.guidance_inquiry_seen(uuid) from public, anon;
grant execute on function public.guidance_inquiry_fill(uuid, text, text, text),
  public.guidance_inquiry_step(uuid, text, text), public.guidance_inquiry_seen(uuid) to authenticated;
-- نهاية الجزء 3
