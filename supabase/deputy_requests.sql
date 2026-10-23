-- =====================================================================
-- التواصل مع وكيل شؤون الطلاب من حساب الطالب أو ولي أمره، بمواصفات طلب مقابلة الموجه:
-- حضورية بموعد أو عن بعد، ومحادثة نصية وصوتية. يُشغَّل بعد guidance_6.sql. تكرار التنفيذ آمن.
-- • target: counselor (الموجه، كما كان) أو deputy (وكيل شؤون الطلاب).
-- • طلب الوكيل يراه الوكيل والمدير والدعم الفني فقط، لا الموجهون.
-- =====================================================================
alter table public.guidance_requests add column if not exists target text not null default 'counselor';
alter table public.guidance_requests drop constraint if exists guidance_requests_target_check;
alter table public.guidance_requests add constraint guidance_requests_target_check check (target in ('counselor', 'deputy'));

-- من يتولى الطلب: الوكيل (ومعه المدير والدعم الفني)، أو موجه الصف كما كان
create or replace function public.greq_can(p_target text, p_grade int) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_target = 'deputy' then public.has_admin_role(array['principal', 'deputy_students', 'tech_support'])
              else public.guidance_can(p_grade) end;
$$;
-- مستلمو إشعار الطلب الجديد ورسائل صاحبه
create or replace function public.greq_staff(p_target text, p_grade int) returns uuid[]
language sql stable security definer set search_path = public as $$
  select array_agg(r.user_id) from admin_roles r
   where r.role_type::text = case when p_target = 'deputy' then 'deputy_students' else 'counselor_' || p_grade end;
$$;

create or replace function public.guidance_request_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare uids uuid[]; nid uuid; who text; staff text;
begin
  staff := case new.target when 'deputy' then 'وكيل شؤون الطلاب' else 'الموجه الطلابي' end;
  if tg_op = 'INSERT' then
    if not public.can_read_student(new.student_id) then raise exception 'غير مصرّح'; end if;
    select v.grade into new.grade from v_active_students v where v.student_id = new.student_id limit 1;
    uids := public.greq_staff(new.target, new.grade);
    who := case new.requester when 'guardian' then 'ولي أمر الطالب ' else 'الطالب ' end
           || (select full_name from students where id = new.student_id);
    if uids is not null then
      nid := public.send_notification('طلب مقابلة ' || staff, who || ': ' || left(new.reason, 120), 'general',
        case new.target when 'deputy' then '/student-requests' else '/guidance' end, null, uids, null, null, true);
    end if;
  elsif new.status is distinct from old.status and new.status in ('scheduled', 'declined') then
    new.updated_at := now();
    nid := public.send_notification(
      case new.status when 'scheduled' then 'تحدد موعد مقابلة ' || staff else 'رد ' || staff || ' على طلبك' end,
      coalesce(to_char(new.appointment_at at time zone 'Asia/Riyadh', 'YYYY/MM/DD HH12:MI') || ' · ', '') || coalesce(new.reply, ''),
      'general', '/', null, array[new.requested_by], null, null, true);
  end if;
  if nid is not null then begin perform public.push_notification(nid); exception when others then null; end; end if;
  return new;
end $$;

create or replace function public.guidance_req_side(p_req text) returns text
language plpgsql stable security definer set search_path = public as $$
declare r guidance_requests;
begin
  select * into r from guidance_requests where id = p_req::uuid;
  if r.id is null then return null; end if;
  if public.greq_can(r.target, r.grade) then return 'counselor'; end if;
  if r.requested_by = auth.uid() then return 'requester'; end if;
  return null;
exception when others then return null;
end $$;

create or replace function public.guidance_message_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare r guidance_requests; nid uuid; uids uuid[]; staff text;
begin
  select * into r from guidance_requests where id = new.request_id;
  staff := case r.target when 'deputy' then 'وكيل شؤون الطلاب' else 'الموجه الطلابي' end;
  new.side := public.guidance_req_side(new.request_id::text);
  if new.side is null then raise exception 'غير مصرّح'; end if;
  if r.status in ('done', 'declined') then raise exception 'أُغلق هذا الطلب'; end if;
  if new.audio_path is not null and new.side = 'requester' and r.requester = 'student' then
    raise exception 'الرسائل الصوتية لولي الأمر وحده'; end if;
  new.sender := auth.uid(); new.created_at := now();
  new.sender_name := (select full_name from users where id = auth.uid());
  if new.side = 'counselor' then
    if r.mode = 'remote' and r.status = 'new' then update guidance_requests set status = 'replied' where id = r.id; end if;
    uids := array[r.requested_by];
  else
    uids := public.greq_staff(r.target, r.grade);
  end if;
  if uids is not null then
    nid := public.send_notification(case new.side when 'counselor' then 'رسالة من ' || staff else 'رسالة في طلب مقابلة' end,
      coalesce(left(nullif(trim(new.body), ''), 120), 'رسالة صوتية'), 'general',
      case when new.side = 'counselor' then '/' when r.target = 'deputy' then '/student-requests'
           else '/guidance?tab=requests&grade=' || r.grade end, null, uids, null, null, true);
    begin perform public.push_notification(nid); exception when others then null; end;
  end if;
  return new;
end $$;

drop policy if exists "guidance requests read" on public.guidance_requests;
create policy "guidance requests read" on public.guidance_requests for select to authenticated
  using (requested_by = auth.uid() or public.greq_can(target, grade));
drop policy if exists "guidance requests update" on public.guidance_requests;
create policy "guidance requests update" on public.guidance_requests for update to authenticated
  using (public.greq_can(target, grade)) with check (public.greq_can(target, grade));
revoke all on function public.greq_can(text, int), public.greq_staff(text, int) from public, anon;
grant execute on function public.greq_can(text, int) to authenticated;
-- نهاية الجزء 1
