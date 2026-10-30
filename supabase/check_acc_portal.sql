-- =====================================================================
-- فحص للقراءة فقط: تحت أي «عام دراسي» حُفظت سجلات كل مصدر من مصادر «جاهز من أعمال البوابة».
-- العدد في القسم يعدّ العام النشط وحده؛ فإن ظهرت سجلات المصدر بعام مكتوب بصيغة أخرى (مثل 1448
-- بدل 1448-1449) أو فارغ، فهي لا تُحسب، ويلزم توحيد الصيغة. يرسل المستخدم النتيجة كما هي.
-- =====================================================================

select (select value from settings where key = 'active_year') as "العام النشط", x.src as "المصدر",
       coalesce(x.y, '(فارغ)') as "العام في السجلات", x.n as "العدد"
from (
  select 'التعاميم' src, academic_year y, count(*) n from circulars group by 2
  union all select 'البرامج الإرشادية', academic_year, count(*) from guidance_programs group by 2
  union all select 'الحالات الإرشادية', academic_year, count(*) from guidance_cases group by 2
  union all select 'برامج الموهوبين', academic_year, count(*) from gifted_programs group by 2
  union all select 'مقياس موهبة', academic_year, count(*) from mawhiba_tracking group by 2
  union all select 'التطوير المهني', academic_year, count(*) from pd_reports group by 2
  union all select 'مجتمعات التعلم', academic_year, count(*) from plc_sessions group by 2
  union all select 'الزيارات التبادلية', academic_year, count(*) from exchange_visits group by 2
  union all select 'أهداف التحسين', academic_year, count(*) from improvement_goals group by 2
  union all select 'محاضر لجنة التميز', academic_year, count(*) from acc_meetings group by 2
  union all select 'محاضر لجنة التحصيل', academic_year, count(*) from ach_meetings group by 2
  union all select 'أيام الحضور الآلي', academic_year, count(distinct attend_date) from daily_attendance group by 2
  union all select 'حضور الحصص', academic_year, count(*) from class_attendance group by 2
  union all select 'إنذارات الغياب', academic_year, count(*) from absence_warnings group by 2
  union all select 'أعذار الغياب', academic_year, count(*) from excused_absences group by 2
  union all select 'حصص الانتظار', academic_year, count(*) from substitute_periods group by 2
  union all select 'الاختبارات (بلا المسودات)', academic_year, count(*) from quizzes where status <> 'draft' group by 2
  union all select 'إشعارات الفترات المنشورة', academic_year, count(*) from period_notices where published group by 2
  union all select 'برامج جلوب', academic_year, count(*) from globe_programs group by 2
) x
order by 2, 3;

-- نهاية الجزء 1
