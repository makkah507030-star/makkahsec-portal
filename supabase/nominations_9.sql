-- =====================================================================
-- الترشيحات (الجزء 9): بطاقة الإعلان في رئيسية المعلمين حين يطلب الإعلان رئيسًا أو قائدًا منهم.
-- • تُعاد دالة المزامنة nom_banner_sync (من nominations_8.sql): إن كان في الإعلان «ترشّح المعلمين
--   للقيادة» ظهرت بطاقته للمعلمين والإداريين أيضًا، وزرها يفتح «فرص المشاركة» وفيها فرص القيادة.
-- • بعد إعلان النتائج تعود البطاقة للطلاب وأولياء الأمور وحدهم («أُعلنت نتائج …»).
-- يُنفَّذ بعد nominations_8.sql في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.nom_banner_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_res boolean := new.results_at is not null;
        v_day date := (new.results_at at time zone 'Asia/Riyadh')::date;   -- يوم الإعلان بتوقيت مكة
begin
  if not (new.home_banner and new.published and new.cancelled_at is null) then
    delete from home_banners where nom_call_id = new.id;
    return new;
  end if;
  insert into home_banners (kind, title, body, image_path, link, link_label, audience, grades, starts_on, ends_on, nom_call_id)
  values (case when v_res then 'general' else 'opportunity' end,
          case when v_res then 'أُعلنت نتائج ' || new.title else new.title end,
          case when v_res then 'اطّلع على نتيجتك في «فرص المشاركة».' else nullif(left(coalesce(new.body, ''), 160), '') end,
          new.banner_image, '/opportunities', case when v_res then 'نتيجتي' else coalesce(nullif(trim(new.banner_label), ''), 'قدّم الآن') end,
          case when nullif(trim(new.staff_lead), '') is not null and not v_res then '{student,guardian,staff}'::text[] else '{student,guardian}' end, case when new.grades @> '{1,2,3}' then '{}' else new.grades end,
          case when v_res then v_day else new.opens_on end,
          case when v_res then v_day + 4 else new.closes_on end, new.id)
  on conflict (nom_call_id) do update set kind = excluded.kind, title = excluded.title, body = excluded.body,
    image_path = excluded.image_path, link_label = excluded.link_label, audience = excluded.audience, grades = excluded.grades,
    starts_on = excluded.starts_on, ends_on = excluded.ends_on;
  return new;
end $$;
drop trigger if exists nom_banner_sync on public.nom_calls;
create trigger nom_banner_sync after insert or update of home_banner, banner_label, staff_lead, published, cancelled_at, results_at, title, body,
  banner_image, grades, opens_on, closes_on on public.nom_calls
  for each row execute function public.nom_banner_sync();
revoke all on function public.nom_banner_sync() from public, anon;

-- تحديث بطاقات الإعلانات المنشورة الآن (تعيد المزامنة بلا تغيير في الإعلان)
update public.nom_calls set staff_lead = staff_lead where staff_lead is not null and published and cancelled_at is null;

-- للتحقق
select c.title as "الإعلان", b.audience as "تظهر لـ", b.link_label as "نص الزر"
  from public.nom_calls c join public.home_banners b on b.nom_call_id = c.id
 order by c.created_at desc limit 5;
-- نهاية الجزء 9
