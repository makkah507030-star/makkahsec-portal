-- =====================================================================
-- بطاقة المعلم بالواقع المعزز (يوم المعلم):
--   لكل معلم رمز عشوائي ar_token يُطبع في رمز QR على بطاقته، فيفتح
--   صفحة /ar/<الرمز> بلا تسجيل دخول، وتعرض بياناته المهنية فقط
--   (الاسم، التخصص، المواد، عدد الفصول والطلاب والحصص) — لا هوية ولا جوال.
-- يُنفَّذ مرة واحدة من Supabase ← SQL Editor، ويمكن إعادة تنفيذه.
-- =====================================================================

alter table public.teachers add column if not exists ar_token uuid not null default gen_random_uuid();
create unique index if not exists teachers_ar_token_idx on public.teachers (ar_token);

-- يُستدعى من الصفحة العامة؛ يعيد null إن كان الرمز غير صحيح أو المعلم غير نشط
create or replace function public.teacher_ar_profile(p_token uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare t public.teachers; y text := active_year(); tm int := active_term(); r json;
begin
  select * into t from public.teachers where ar_token = p_token and is_active;
  if t.id is null then return null; end if;

  with sch as (
    select s.class_id, s.subject_id from public.schedule s
    where s.teacher_id = t.id and s.academic_year = y and s.term = tm
  )
  select json_build_object(
    'name', t.full_name,
    'spec', t.specialization,
    'subjects', coalesce((select json_agg(distinct sb.name) from sch join public.subjects sb on sb.id = sch.subject_id), '[]'::json),
    'classes', (select count(distinct class_id) from sch),
    'students', (select count(distinct e.student_id) from public.student_enrollment e
                 where e.class_id in (select class_id from sch) and e.academic_year = y and e.status = 'active'),
    'periods', (select count(*) from sch),
    'video', (select value from public.settings where key = 'teacher_ar_video')
  ) into r;
  return r;
end $$;

grant execute on function public.teacher_ar_profile(uuid) to anon, authenticated;
