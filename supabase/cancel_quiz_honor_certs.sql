-- =====================================================================
-- إلغاء شهادات تفوق «اختبار قصير» لمن ليس متفوقًا بالدرجة الصحيحة — الجزء 1 من 1.
-- صدرت بنسب خاطئة (الدرجة الكلية 3 بدل 5): من حصل على 4 من 5 (80%) ظهر 133% متفوقًا.
-- • تُلغى (حالتها «rejected» بملاحظة السبب) شهادات التفوق التي أصدرها معلم الاختبار
--   لطلابه بعد اعتماد تحليله، إن كانت نسبة الطالب الصحيحة دون 90%، وفي نصها اسم الاختبار.
-- • لا تُحذف: تبقى في السجل ملغاة، ولا تُحتسب شاهدًا ولا تظهر للطالب صادرة،
--   ويمكن إرجاعها بتغيير حالتها إلى issued.
-- • شهادات المتفوقين الحقيقيين (90% فأكثر) لا تُمس.
-- يُنفَّذ في Supabase ← SQL Editor بعد fix_quiz_total_marks.sql، وتكرار التنفيذ آمن.
-- =====================================================================
with qz as (
  select id, teacher_id, analyzed_at, total_marks, title from public.quizzes
   where title = 'اختبار قصير' and analyzed_at is not null
     and exists (select 1 from public.teachers t where t.user_id = quizzes.teacher_id and t.full_name like '%ضحيان الذبياني%')
),
low as (   -- طلاب الاختبار ونسبتهم الصحيحة دون 90%
  select qz.id as quiz_id, s.student_id
    from qz join public.quiz_submissions s on s.quiz_id = qz.id
   where not coalesce(s.absent, false) and s.score is not null and s.score / qz.total_marks < 0.9
)
update public.form_documents d
   set status = 'rejected',
       decision_note = 'أُلغيت: صدرت بنسبة خاطئة في «اختبار قصير» (الدرجة الكلية 3 بدل 5)، والنسبة الصحيحة دون 90%.'
  from qz, public.form_templates ft
 where ft.id = d.template_id and ft.category = 'certificate'
   and d.created_by = qz.teacher_id and d.created_at >= qz.analyzed_at
   and d.status not in ('draft', 'pending', 'rejected')
   and d.student_id in (select student_id from low where low.quiz_id = qz.id)
   and (d.data::text like '%' || qz.title || '%' or d.title like '%' || qz.title || '%')
returning d.recipient as "الطالب", d.serial as "رقم الشهادة", d.title as "الشهادة", d.created_at::date as "تاريخ الإصدار";
-- نهاية الجزء 1
