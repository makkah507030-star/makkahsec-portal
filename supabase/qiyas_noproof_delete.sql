-- =====================================================================
-- حذف نتائج قياس التي أدخلها الطلاب من حساباتهم بلا إثبات (صورة النتيجة)، بعد أن صار الإثبات
-- مطلوبًا (qiyas_results_3.sql). لا يمس نتائج تقرير المركز ولا ما أدخلته اللجنة.
-- شغّل الجزء الأول وحده أولًا لترى ما سيُحذف، ثم الجزء الثاني. يُشغَّل مرة واحدة.
-- =====================================================================

-- الجزء الأول (للاطلاع): النتائج التي ستُحذف
select s.full_name as "الطالب", r.test as "الاختبار", r.attempt as "المحاولة", r.score as "الدرجة", r.created_at as "أُدخلت"
from public.qiyas_results r join public.students s on s.id = r.student_id
where r.source = 'student' and r.proof_path is null
order by s.full_name;

-- الجزء الثاني (الحذف): ظلّل هذا السطر وحده وشغّله بعد التأكد من القائمة أعلاه
delete from public.qiyas_results where source = 'student' and proof_path is null;

-- نهاية الجزء 1
