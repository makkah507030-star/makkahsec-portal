-- ملف الأداء الوظيفي — حالة كل بند في البوابة (يظهر وسمًا تحت البند في ملف المعلم).
-- auto: تنتجه البوابة (الربط التلقائي بالملف قريبًا) · partial: جزئي · manual: يُرفع يدويًا
-- record: سجل التطوير المهني · judge: يقدّره المقيِّم بالملاحظة. بنود المقيِّم بلا حالة.
-- يُنفَّذ بعد teacher_performance.sql، وتكرار التنفيذ آمن.

alter table public.perf_items add column if not exists portal text
  check (portal in ('auto', 'partial', 'manual', 'record', 'judge'));

update public.perf_items set portal = 'partial' where element_key <> 'e01';

update public.perf_items set portal = 'record' where is_record;

update public.perf_items set portal = 'auto' where key in (
  'e03_01', 'e03_02', 'e03_04', 'e03_06', 'e05_02', 'e05_04', 'e05_10',
  'e07_06', 'e10_01', 'e10_02', 'e10_03', 'e11_02', 'e11_03', 'e11_04');

update public.perf_items set portal = 'manual' where key in (
  'e02_09', 'e02_10', 'e02_11', 'e03_07',
  'e05_01', 'e05_06', 'e05_07', 'e05_08', 'e05_09', 'e05_11',
  'e06_01', 'e06_02', 'e06_03', 'e06_04', 'e06_05', 'e06_08',
  'e07_01', 'e07_04', 'e07_05', 'e10_04', 'e10_05');

update public.perf_items set portal = 'judge' where key in ('e06_07', 'e07_03');

-- تحقق: auto 14 · manual 21 · partial 24 · record 8 · judge 2
select portal, count(*) from public.perf_items where portal is not null group by portal order by portal;
