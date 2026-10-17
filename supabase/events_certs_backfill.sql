-- =====================================================================
-- تقدير الشهادات الصادرة قبل تسجيل الطباعة (عدّاد الشهادات).
--
-- قبل هذا التعديل كانت الشهادة تُطبع دون تسجيل، فالعدّاد صفر للأحداث القديمة.
-- التقدير: الحدث الذي تجاوز مرحلة الشهادات (التقرير أو الاعتماد) وُزّعت فيه شهادات
-- لكل طالب سُجّل «حضر»، ولكل ضيف مسجّل في قائمة ضيوفه.
-- تاريخ الإصدار المقدَّر: رفع التقرير، وإلا الاعتماد، وإلا يوم الحدث.
--
-- لا يمسّ ما سُجّل فعلًا (cert_issued_at أو cert_at موجود)، ولا الأحداث الملغاة.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار تنفيذه لا يغيّر شيئًا.
-- =====================================================================

-- ١) الطلاب الحاضرون
update public.event_participants p
set cert_issued_at = coalesce(e.report_submitted_at, e.approved_at, e.event_date::timestamptz)
from public.school_events e
where e.id = p.event_id
  and e.stage in ('report', 'approved')
  and e.cancelled_at is null
  and p.attended is true
  and p.cert_issued_at is null;

-- ٢) الضيوف والمتعاونون: تاريخ cert_at مع كل ضيف بلا تاريخ
update public.school_events e
set guests = (
  select jsonb_agg(case when g ? 'cert_at' or coalesce(g->>'name', '') = '' then g
                        else g || jsonb_build_object('cert_at',
                               coalesce(e.report_submitted_at, e.approved_at, e.event_date::timestamptz)) end
                   order by ord)
  from jsonb_array_elements(e.guests) with ordinality as x(g, ord))
where e.stage in ('report', 'approved')
  and e.cancelled_at is null
  and jsonb_typeof(e.guests) = 'array'
  and exists (select 1 from jsonb_array_elements(e.guests) g
              where not g ? 'cert_at' and coalesce(g->>'name', '') <> '');

-- ٣) للتحقق: الشهادات المعدودة الآن
select
  (select count(*) from public.event_participants where cert_issued_at is not null) as students,
  (select count(*) from public.school_events e, jsonb_array_elements(
     case when jsonb_typeof(e.guests) = 'array' then e.guests else '[]'::jsonb end) g
   where g ? 'cert_at') as guests;

-- نهاية الملف
