-- =====================================================================
-- الاختبار الإلكتروني: إعادة الاختبار لطلاب يختارهم المعلم، مع إعادة الفتح للغائبين.
-- • retake_online_quiz(p_quiz, p_students): يمسح محاولة من سلّم من الطلاب المختارين
--   (البدء والتسليم والمسودة) فيدخل الاختبار من جديد، ويُعدّ له retakes.
-- • تبقى درجته السابقة محفوظة حتى يسلّم المحاولة الجديدة فتحل محلها؛ وإن لم يختبر حتى
--   الموعد الجديد بقيت السابقة ولا يُسجَّل غائبًا.
-- • للاختبار الإلكتروني وحده (لا «دون إنترنت»)، ولصاحب الاختبار وحده.
-- • بعدها يُستدعى publish_online_quiz بإعادة الإشعار كما في «إعادة الفتح»، فيصل الإشعار
--   للغائبين وللمختارين معًا.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
alter table public.quiz_assignments add column if not exists retakes int not null default 0;

create or replace function public.retake_online_quiz(p_quiz uuid, p_students uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare qz quizzes%rowtype; n int;
begin
  select * into qz from quizzes where id = p_quiz;
  if qz.id is null or qz.teacher_id <> auth.uid() then raise exception 'غير مصرّح: الاختبار ليس لك'; end if;
  if qz.mode = 'offline' then raise exception 'إعادة الاختبار متاحة للاختبار الإلكتروني وحده'; end if;
  update quiz_assignments
     set started_at = null, deadline_at = null, submitted_at = null, draft = '{}'::jsonb,
         notified_at = null, retakes = retakes + 1
   where quiz_id = p_quiz and student_id = any(coalesce(p_students, '{}'))
     and submitted_at is not null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.retake_online_quiz(uuid, uuid[]) from public, anon;
grant execute on function public.retake_online_quiz(uuid, uuid[]) to authenticated;

-- للتحقق
select count(*) filter (where retakes > 0) as "طلاب أعادوا الاختبار",
       to_regprocedure('public.retake_online_quiz(uuid, uuid[])') is not null as "الدالة جاهزة"
  from public.quiz_assignments;
-- نهاية الجزء 1
