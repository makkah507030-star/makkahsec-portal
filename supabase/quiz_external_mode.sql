-- =====================================================================
-- الاختبار من خارج البوابة (mode = 'external'): اختبار أعدّه المعلم وطبّقه
-- خارج البوابة، بلا أسئلة فيها. يُدخل بياناته ودرجته الكلية، ويرصد مجموع
-- كل طالب (quiz_save_manual_score)، فيدخل في التحليل والخطط والشواهد.
-- تكرار التنفيذ آمن.
-- =====================================================================

alter table public.quizzes drop constraint if exists quizzes_mode_check;
alter table public.quizzes
  add constraint quizzes_mode_check check (mode in ('omr', 'paper', 'online', 'external'));
-- نهاية الملف
