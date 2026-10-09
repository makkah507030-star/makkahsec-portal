-- =====================================================================
-- التوجيه الطلابي — الجزء 4: طلب مقابلة الموجه من الطالب أو ولي أمره.
-- يصل الطلب لموجه صف الطالب وحده (ومعه الوكيل والمدير والدعم الفني)، ويصله
-- إشعار. يحدد الموجه الموعد أو يرد، فيصل الإشعار لصاحب الطلب.
-- يُنفَّذ بعد الجزء 1. تكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.guidance_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  grade int,                                       -- يُملأ من صف الطالب تلقائيًا
  requested_by uuid not null default auth.uid(),
  requester text not null default 'student' check (requester in ('student', 'guardian')),
  reason text not null check (length(trim(reason)) > 0),
  preferred text,                                  -- الوقت المفضل
  status text not null default 'new' check (status in ('new', 'scheduled', 'done', 'declined')),
  appointment_at timestamptz,
  reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- صف الطالب، والتحقق من صاحب الطلب، والإشعارات
create or replace function public.guidance_request_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare uids uuid[]; nid uuid; who text;
begin
  if tg_op = 'INSERT' then
    if not public.can_read_student(new.student_id) then raise exception 'غير مصرّح'; end if;
    select v.grade into new.grade from v_active_students v where v.student_id = new.student_id limit 1;
    select array_agg(r.user_id) into uids from admin_roles r where r.role_type::text = 'counselor_' || new.grade;
    who := case new.requester when 'guardian' then 'ولي أمر الطالب ' else 'الطالب ' end
           || (select full_name from students where id = new.student_id);
    if uids is not null then
      nid := public.send_notification('طلب مقابلة الموجه الطلابي', who || ': ' || left(new.reason, 120),
                                      'general', '/guidance', null, uids, null, null, true);
    end if;
  elsif new.status is distinct from old.status and new.status in ('scheduled', 'declined') then
    new.updated_at := now();
    nid := public.send_notification(
      case new.status when 'scheduled' then 'تحدد موعد مقابلة الموجه الطلابي' else 'رد الموجه الطلابي على طلبك' end,
      coalesce(to_char(new.appointment_at at time zone 'Asia/Riyadh', 'YYYY/MM/DD HH12:MI') || ' · ', '') || coalesce(new.reply, ''),
      'general', '/', null, array[new.requested_by], null, null, true);
  end if;
  if nid is not null then
    begin perform public.push_notification(nid); exception when others then null; end;
  end if;
  return new;
end $$;

drop trigger if exists guidance_request_trg on public.guidance_requests;
create trigger guidance_request_trg before insert or update on public.guidance_requests
  for each row execute function public.guidance_request_trg();

alter table public.guidance_requests enable row level security;
drop policy if exists "guidance requests read" on public.guidance_requests;
create policy "guidance requests read" on public.guidance_requests for select to authenticated
  using (requested_by = auth.uid() or public.guidance_can(grade));
drop policy if exists "guidance requests insert" on public.guidance_requests;
create policy "guidance requests insert" on public.guidance_requests for insert to authenticated
  with check (requested_by = auth.uid());
drop policy if exists "guidance requests update" on public.guidance_requests;
create policy "guidance requests update" on public.guidance_requests for update to authenticated
  using (public.guidance_can(grade)) with check (public.guidance_can(grade));
-- نهاية الجزء 4
