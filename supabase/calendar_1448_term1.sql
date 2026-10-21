-- التقويم الدراسي 1448هـ (مكة والمدينة وجدة والطائف): الفصل الأول وبداية الثاني.
-- يضيف ما لم يُسجَّل من قبل فقط (بالنوع وتاريخ البداية)، فتكرار التنفيذ آمن ولا يكرر السطور.
-- يعتمد عليه: بطاقة «الأسبوع الدراسي» وأحداثها، وأيام الإجازة في الحضور، وملف المعلم الرقمي.

insert into public.academic_calendar (title, kind, start_date, end_date, hijri_label, academic_year, is_active)
select v.title, v.kind, v.s::date, v.e::date, v.h, (select value from public.settings where key = 'active_year'), true
  from (values
    ('عودة المعلمين والمعلمات',                'event',      '2026-08-23', null,         '10/03/1448'),
    ('بداية الدراسة للفصل الدراسي الأول',      'term_start', '2026-08-30', null,         '17/03/1448'),
    ('إجازة اليوم الوطني',                     'holiday',    '2026-09-23', '2026-09-24', '12/04/1448 – 13/04/1448'),
    ('إجازة إضافية',                           'holiday',    '2026-10-25', '2026-10-25', '14/05/1448'),
    ('إجازة الخريف',                           'holiday',    '2026-11-20', '2026-11-28', '10/06/1448 – 18/06/1448'),
    ('اختبارات نهاية الفصل الدراسي الأول',     'exam',       '2027-01-03', '2027-01-07', '25/07/1448 – 29/07/1448'),
    ('نهاية الفصل الدراسي الأول',              'term_end',   '2027-01-07', null,         '29/07/1448'),
    ('إجازة منتصف العام الدراسي',              'holiday',    '2027-01-08', '2027-01-16', '30/07/1448 – 08/08/1448'),
    ('بداية الدراسة للفصل الدراسي الثاني',     'term_start', '2027-01-17', null,         '09/08/1448')
  ) as v(title, kind, s, e, h)
 where not exists (select 1 from public.academic_calendar c
                    where c.kind = v.kind and c.start_date = v.s::date and c.is_active);

-- للتحقق: التقويم من عودة المعلمين إلى بداية الفصل الثاني.
-- إن ظهر سطر مكرر لحدث واحد بعنوانين (سُجّل سابقًا بتاريخ آخر)، فاحذف الزائد من «التقويم والإجازات».
select kind as النوع, title as العنوان, start_date as من, end_date as إلى, is_active as مفعّل
  from public.academic_calendar
 where start_date between '2026-08-01' and '2027-01-31'
 order by start_date, kind;
-- نهاية الجزء 1
