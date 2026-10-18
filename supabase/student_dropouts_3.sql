-- توحيد ردود وكيل شؤون الطلاب على بلاغات الانقطاع المردودة
-- كل بلاغ «رُدّ البلاغ — منتظم» تصبح عبارته الموحّدة:
update public.student_dropouts
   set decision_note = 'الطالب منتظم ولديه غيابات جاري دراسة حالته'
 where status = 'dismissed';

-- للتحقق: عدد البلاغات المردودة وعباراتها بعد التعديل
select decision_note, count(*) from public.student_dropouts
 where status = 'dismissed' group by decision_note;
-- نهاية الجزء 1
