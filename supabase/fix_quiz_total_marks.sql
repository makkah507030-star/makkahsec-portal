-- =====================================================================
-- تصحيح الدرجة الكلية لاختبارات صُحّحت بدرجات أسئلة تزيد عليها — الجزء 1 من 1.
-- مثال: «اختبار قصير» درجته الكلية 3 وأسئلته من 5، فظهرت النسب 166% وانقلبت
-- الخطة العلاجية والإثرائية (المتعثر بدرجة 2 من 5 صار 66% فلم يدخل الخطة).
-- يُصحَّح فقط ما فيه درجة مرصودة أعلى من الدرجة الكلية (دليل قاطع على الخطأ)،
-- فتصير الدرجة الكلية مجموع درجات الأسئلة. بعده يضغط المعلم «تحديث التحليل» في دورة الاختبار.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
with bad as (
  select q.id, q.title, q.total_marks as old_total,
         (select sum(marks) from public.quiz_questions qq where qq.quiz_id = q.id) as qsum
    from public.quizzes q
   where exists (select 1 from public.quiz_submissions s
                  where s.quiz_id = q.id and s.score > q.total_marks)
)
update public.quizzes q
   set total_marks = bad.qsum
  from bad
 where q.id = bad.id and bad.qsum is not null and bad.qsum > 0 and bad.qsum <> bad.old_total
returning q.title as "الاختبار", bad.old_total as "الدرجة الكلية السابقة", q.total_marks as "الدرجة الكلية الآن";
-- نهاية الجزء 1
