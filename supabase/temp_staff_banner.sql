-- =====================================================================
-- حل مؤقت إلى دمج صفحة «فرص المشاركة» للمعلمين: بطاقة الإعلان للطلاب وأولياء الأمور وحدهم،
-- وبطاقة مستقلة للمعلمين والإداريين بلا زر توجّههم إلى «فرص القيادة» في رئيسيتهم.
-- بعد الدمج يُشغَّل temp_staff_banner_undo.sql. تكرار التنفيذ آمن.
-- =====================================================================
update public.home_banners b set audience = '{student,guardian}'
  from public.nom_calls c
 where b.nom_call_id = c.id and c.staff_lead is not null and c.results_at is null;

delete from public.home_banners where title like 'مطلوب: %' and nom_call_id is null and link is null;
insert into public.home_banners (kind, title, body, link, link_label, audience, grades, starts_on, ends_on)
select 'opportunity', 'مطلوب: ' || c.staff_lead,
       left(coalesce(nullif(trim(c.staff_body), ''), c.body, ''), 120) || ' — رشّح نفسك من بطاقة «فرص القيادة» أسفل هذه الصفحة.',
       null, null, '{staff}', '{}', c.opens_on, c.closes_on
  from public.nom_calls c
 where c.staff_lead is not null and c.published and c.cancelled_at is null and c.results_at is null;

-- للتحقق
select title as "البطاقة", audience as "تظهر لـ", coalesce(link, 'بلا زر') as "الزر"
  from public.home_banners
 where nom_call_id is not null or title like 'مطلوب: %'
 order by created_at desc limit 5;
-- نهاية الجزء 1
