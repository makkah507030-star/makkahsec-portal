-- =====================================================================
-- معمل الحاسب الآلي (13): تفعيل المعمل الثاني بأجهزته الـ21.
-- المعمل الثاني موجود في جدول labs منذ الجزء 1 وغير مفعّل؛ يُفعَّل هنا، وتُضاف أجهزته
-- PC2-01 إلى PC2-21 بحالة «يعمل»، وتُكمَّل مواصفاتها من «سجل الأجهزة».
-- بعد التفعيل يظهر في صفحة المعمل مبدّل بين المعملين، ولكل معمل حجزه وجلوسه وأجهزته وبلاغاته.
-- تكرار التنفيذ آمن، ولا يمسّ المعمل الأول.
-- =====================================================================

insert into public.labs (id, name, is_active) values (2, 'معمل الحاسب الآلي 2', true)
on conflict (id) do update set is_active = true;

insert into public.lab_devices (lab_id, seat_no, code)
select 2, g, 'PC2-' || lpad(g::text, 2, '0') from generate_series(1, 21) g
on conflict do nothing;

-- للتحقق
select l.id as "المعمل", l.name as "الاسم", l.is_active as "مفعّل", count(d.id) as "الأجهزة"
  from public.labs l left join public.lab_devices d on d.lab_id = l.id
 group by l.id, l.name, l.is_active order by l.id;
-- نهاية الجزء 13
