-- =====================================================================
-- إلغاء الحل المؤقت (temp_staff_banner.sql) بعد دمج صفحة «فرص المشاركة» للمعلمين:
-- تُحذف بطاقة المعلمين المستقلة، وتعود بطاقة الإعلان للطلاب والمعلمين معًا بزرها.
-- تكرار التنفيذ آمن.
-- =====================================================================
delete from public.home_banners where title like 'مطلوب: %' and nom_call_id is null and link is null;
update public.nom_calls set staff_lead = staff_lead where staff_lead is not null and published and cancelled_at is null;

-- للتحقق
select c.title as "الإعلان", b.audience as "تظهر لـ", b.link_label as "نص الزر"
  from public.nom_calls c join public.home_banners b on b.nom_call_id = c.id
 order by c.created_at desc limit 5;
-- نهاية الجزء 1
