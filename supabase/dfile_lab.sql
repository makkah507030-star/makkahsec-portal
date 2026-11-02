-- =====================================================================
-- ملف المعلم الرقمي: قسم «المعمل الرقمي ومعمل الحاسب» — حجم عمل المعلم في المعمل.
-- • dfile_lab(كود الملف): يفتحه الزائر بكود الملف كبقية التقرير، ولا يعرض أسماء طلاب.
--   حصصه في المعمل، وحصص الدروس الرقمية ونتائجها، وسجل التطبيقات، واستخدام كل درس،
--   ولمحضر المعمل أرقام الأجهزة والبلاغات والسلامة والجلوس.
-- • teacher_dfiles.lab_author: المعلم أعدّ دروس المعمل الرقمي، فتُعرض مكتبتها باسمه.
-- يُنفَّذ بعد teacher_dfile_*.sql وcomputer_lab_*.sql. تكرار التنفيذ آمن.
-- =====================================================================

alter table public.teacher_dfiles add column if not exists lab_author boolean not null default false;

create or replace function public.dfile_lab(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f public.teacher_dfiles; uid uuid; tid uuid; prep boolean;
begin
  select d.* into f from public.teacher_dfiles d join public.users u on u.id = d.teacher_user_id
   where d.code = upper(trim(p_code)) and d.disabled_at is null and u.is_active;
  if not found then return null; end if;
  uid := f.teacher_user_id;
  tid := (select id from public.teachers where user_id = uid);
  prep := exists (select 1 from public.admin_roles r where r.user_id = uid and r.role_type::text = 'computer_lab');
  return jsonb_build_object(
    'author', f.lab_author,
    'prep', prep,
    'periods',  (select count(*) from lab_bookings where teacher_id = tid and booking_date <= current_date and coalesce(used, true)),
    'classes',  (select count(distinct class_id) from lab_bookings where teacher_id = tid),
    'days',     (select count(distinct booking_date) from lab_bookings where teacher_id = tid and booking_date <= current_date),
    'sessions', (select count(*) from lab_sessions where created_by = uid),
    'session_classes', (select count(distinct class_id) from lab_sessions where created_by = uid),
    'results',  (select count(*) from lab_results r join lab_sessions s on s.id = r.session_id where s.created_by = uid),
    'mastery',  (select round(avg(r.mastery)) from lab_results r join lab_sessions s on s.id = r.session_id
                  where s.created_by = uid and r.mastery is not null),
    'quiz',     (select round(avg(r.quiz)) from lab_results r join lab_sessions s on s.id = r.session_id
                  where s.created_by = uid and r.quiz is not null),
    'works',    (select count(*) from lab_works where teacher_id = tid),
    'marks',    (select count(*) from lab_work_marks m join lab_works w on w.id = m.work_id where w.teacher_id = tid),
    'by_lesson', (select coalesce(jsonb_agg(jsonb_build_object('id', x.lesson_id, 'n', x.n, 'st', x.st, 'm', x.m) order by x.n desc), '[]') from (
                   select s.lesson_id, count(distinct s.id) n, count(r.student_id) st, round(avg(r.mastery)) m
                     from lab_sessions s left join lab_results r on r.session_id = s.id
                    where s.created_by = uid group by s.lesson_id) x),
    'lab', case when not prep then null else jsonb_build_object(
      'devices',   (select count(*) from lab_devices),
      'ok',        (select count(*) from lab_devices where status = 'ok'),
      'tickets',   (select count(*) from lab_tickets),
      'resolved',  (select count(*) from lab_tickets where status = 'resolved'),
      'hours',     (select round(avg(extract(epoch from updated_at - created_at) / 3600)::numeric, 1) from lab_tickets where status = 'resolved'),
      'bookings',  (select count(*) from lab_bookings where booking_date <= current_date and coalesce(used, true)),
      'teachers',  (select count(distinct teacher_id) from lab_bookings),
      'weeks',     (select count(distinct date_trunc('week', booking_date + 1)) from lab_bookings where booking_date <= current_date),
      'rules',     (select coalesce(jsonb_array_length(items), 0) from lab_rules where id = 1),
      'acks',      (select count(distinct student_id) from lab_rule_acks),
      'seats',     (select count(distinct class_id) from lab_seats),
      'installs',  (select count(*) from lab_installs)) end);
end; $$;
revoke execute on function public.dfile_lab(text) from public;
grant execute on function public.dfile_lab(text) to anon, authenticated;
-- نهاية الجزء 1
