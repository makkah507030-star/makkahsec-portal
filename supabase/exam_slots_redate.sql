-- =====================================================================
-- إعادة حساب تواريخ اختبارات الفترات (لكل فصل) من بداية فترة الاختبارات.
--
-- السبب: تاريخ الاختبار يُحسب لحظة اختيار الخانة في «جداول الاختبارات»
-- من بداية الفترة وقتها؛ فإن عُدّلت البداية بعد ذلك بقيت الخانات المختارة
-- بتواريخها القديمة (مثل 19/09/2026 وفترة الاختبار 11/10–15/10).
-- الحساب مطابق لما في الصفحة: أحد أسبوع البداية + (اليوم − 1) + (الأسبوع − 1) × 7.
-- الاختبارات النهائية (على مستوى الصف) لا تُمسّ، فتواريخها تُدخل يدويًا.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

update public.exam_slots s
set exam_date = t.start_date
                - extract(dow from t.start_date)::int
                + (s.day_of_week - 1)
                + (coalesce(s.exam_week, 1) - 1) * 7
from public.exam_terms t
where t.id = s.exam_term_id
  and t.kind <> 'final'
  and s.class_id is not null
  and s.day_of_week is not null
  and t.start_date is not null
  and s.exam_date is distinct from
      t.start_date - extract(dow from t.start_date)::int + (s.day_of_week - 1) + (coalesce(s.exam_week, 1) - 1) * 7;

-- للتحقق: أي اختبار ما زال خارج فترته (يُفترض ألا يظهر شيء)
select t.title, c.class_no, s.subject_name, s.exam_date, t.start_date, t.end_date
from public.exam_slots s
join public.exam_terms t on t.id = s.exam_term_id
left join public.classes c on c.id = s.class_id
where s.exam_date < t.start_date or s.exam_date > t.end_date
order by t.title, c.class_no, s.exam_date;
