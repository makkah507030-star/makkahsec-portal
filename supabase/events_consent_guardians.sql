-- =====================================================================
-- إصلاح: «تعذّر الإصدار: لا أولياء أمور بحسابات لهؤلاء الطلاب»
--
-- السبب: مرحلة الموافقات تقرأ ولي أمر كل طالب من guardian_student و guardians
-- مباشرة، وقواعد الصلاحية على هذين الجدولين لا تسمح لمنظّم الحدث (معلم،
-- رائد نشاط...) بقراءتهما، فتعود النتيجة فارغة وكأن الطالب بلا ولي أمر.
--
-- الحل: دالة security definer تُرجع أولياء أمور المشاركين في حدث معيّن
-- (ممن لهم حساب)، ولا تعمل إلا لمن يدير الحدث — بنفس شرط ev_is_manager.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- يتطلب تنفيذ events_rls_fix.sql قبله.
-- =====================================================================

create or replace function public.ev_participant_guardians(p_event public.school_events.id%type)
returns table (student_id public.students.id%type, user_id uuid, full_name text)
language sql stable security definer set search_path = public as $$
  select distinct on (p.student_id, g.user_id) p.student_id, g.user_id, g.full_name
  from public.event_participants p
  join public.guardian_student gs on gs.student_id = p.student_id
  join public.guardians g on g.id = gs.guardian_id
  where p.event_id = p_event
    and g.user_id is not null
    and public.ev_is_manager(p_event, array['principal', 'tech_support', 'deputy_students']);
$$;

revoke execute on function public.ev_participant_guardians from public, anon;
grant  execute on function public.ev_participant_guardians to authenticated;
