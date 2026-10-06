-- =====================================================================
-- اختباراتي: بلا أي حدّ — لا لعدد الأسئلة ولا لفقرات المزاوجة.
--
-- يزيل الحارس guard_quiz_limits نهائيًا. الواجهة صارت تتكيّف:
--   • ورقة التصحيح الآلي تتوزّع على صفحات مهما زادت الأسئلة.
--   • بطاقة التظليل تقلّل أعمدتها تلقائيًا إن طال صف المزاوجة، فتتّسع دوائره.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

drop trigger if exists trg_guard_quiz_limits on public.quiz_questions;
drop function if exists public.guard_quiz_limits();

-- للتحقق: يجب أن يكون 0
select count(*) as guards_left
from pg_trigger where tgname = 'trg_guard_quiz_limits';
