-- =====================================================================
-- مركز التدريب — القدرات (الدفعة الثالثة، الجزء 1 من 2): أسئلة الطالب لمعلم المادة
-- الكمي يصل إلى معلم الرياضيات في فصل الطالب، واللفظي إلى معلم اللغة العربية
-- (الكفايات اللغوية). إن لم يوجد يظهر للإدارة لتجيب. يلزم قبله qudrat_1.sql.
-- تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.qudrat_asks (
  id           uuid primary key default gen_random_uuid(),
  student_user uuid not null default auth.uid(),
  student_id   uuid,                      -- سجل الطالب إن كان الحساب طالبًا
  teacher_id   uuid,                      -- المعلم الذي يصله السؤال
  qkey         text,                      -- السؤال الذي يسأل عنه (اختياري)
  q_text       text,                      -- نصه وقت السؤال
  sec          text not null check (sec in ('quant', 'verbal')),
  skill        text,
  body         text not null check (length(body) between 2 and 1000),
  reply        text,
  replied_by   uuid,
  replied_at   timestamptz,
  seen         boolean not null default false,   -- اطلع الطالب على الرد
  created_at   timestamptz not null default now()
);
create index if not exists qudrat_asks_teacher on public.qudrat_asks (teacher_id, replied_at);
create index if not exists qudrat_asks_student on public.qudrat_asks (student_user, created_at desc);

-- معلم المادة في فصل الطالب: الأكثر حصصًا من مواد القسم
create or replace function public.qudrat_route_teacher(p_student uuid, p_sec text)
returns uuid language sql stable security definer set search_path = public as $$
  select sch.teacher_id
  from schedule sch
  join subjects sb on sb.id = sch.subject_id
  join student_enrollment se on se.class_id = sch.class_id and se.academic_year = sch.academic_year
  where se.student_id = p_student and se.status = 'active' and se.academic_year = active_year()
    and sch.teacher_id is not null
    and case p_sec when 'quant' then sb.name ~ 'رياضيات'
                   else sb.name ~ '(لغوية|لغتي|عربية|العربية|نحو|بلاغة)' end
  group by sch.teacher_id order by count(*) desc limit 1;
$$;

-- عند الإرسال: صاحب السؤال هو الحساب نفسه، والمعلم يُحدد تلقائيًا ويصله إشعار
create or replace function public.qudrat_ask_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare nid uuid; tu uuid;
begin
  new.student_user := auth.uid();
  new.student_id := (select id from students where user_id = auth.uid() limit 1);
  new.teacher_id := case when new.student_id is null then null else qudrat_route_teacher(new.student_id, new.sec) end;
  new.reply := null; new.replied_by := null; new.replied_at := null; new.seen := false;
  tu := (select user_id from teachers where id = new.teacher_id);
  if tu is not null then
    nid := send_notification('سؤال من طالب في مركز التدريب (القدرات)',
             coalesce((select full_name from students where id = new.student_id), 'طالب') || ': ' || left(new.body, 120),
             'general', '/qudrat/asks', null, array[tu], null, null, true);
    begin perform push_notification(nid); exception when others then null; end;
  end if;
  return new;
end $$;
drop trigger if exists qudrat_ask_before on public.qudrat_asks;
create trigger qudrat_ask_before before insert on public.qudrat_asks
  for each row execute function public.qudrat_ask_before();

alter table public.qudrat_asks enable row level security;
drop policy if exists "qudrat asks read" on public.qudrat_asks;
create policy "qudrat asks read" on public.qudrat_asks for select to authenticated
  using (student_user = (select auth.uid()) or teacher_id = (select public.current_teacher_id())
         or (select public.qudrat_manager()));
drop policy if exists "qudrat asks add" on public.qudrat_asks;
create policy "qudrat asks add" on public.qudrat_asks for insert to authenticated
  with check (true);   -- الدالة السابقة تثبّت صاحب السؤال ومعلمه
-- لا تعديل مباشر: الرد والاطلاع بالدالتين في الجزء 2

-- نهاية الجزء 1
