-- =====================================================================
-- اختباراتي: أسئلة بلا حدّ عدد في كل الأنماط — في قاعدة البيانات أيضًا.
--
-- كان الحارس guard_quiz_limits يرفض السؤال إذا بلغ عدد أسئلة نمطه حدًّا
-- يُقرأ من الإعدادات (quiz_max_mcq، quiz_max_truefalse، …) أو 99، فيظهر
-- للمعلم «بلغت الحد الأعلى لهذا النمط» رغم أن الواجهة صارت بلا حدّ وورقة
-- التصحيح الآلي تتوزّع على صفحات.
--
-- بعد هذا الملف:
--   • لا حدّ لعدد الأسئلة.
--   • يبقى حدّ فقرات المزاوجة كما في الواجهة: 5 في التصحيح الآلي والإلكتروني
--     (يتّسع لها تصميم بطاقة التظليل)، و8 في الاختبار الورقي.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.guard_quiz_limits()
returns trigger
language plpgsql
as $function$
declare
  lim  int;
  v_mode text;
begin
  -- فقرات المزاوجة فقط — عدد الأسئلة نفسه بلا حدّ
  if new.kind = 'match' then
    select q.mode into v_mode from public.quizzes q where q.id = new.quiz_id;
    lim := case when v_mode = 'paper' then 8 else 5 end;
    if jsonb_array_length(coalesce(new.options->'left', '[]'::jsonb)) > lim then
      raise exception 'الحد الأعلى لفقرات المزاوجة % فقرات.', lim;
    end if;
  end if;
  return new;
end $function$;

-- إعدادات الحدود القديمة لم تعد تُستخدم
delete from public.settings where key like 'quiz\_max\_%';

-- للتحقق: يجب ألا يظهر حدّ لعدد الأسئلة في نص الدالة
select pg_get_functiondef('public.guard_quiz_limits'::regproc) like '%count(*)%' as still_counts;
