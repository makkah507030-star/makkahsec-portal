-- =====================================================================
-- الترشيحات (الجزء 8): نص زر بطاقة الإعلان في الرئيسية لكل إعلان.
-- • nom_calls.banner_label: نص الزر (مثل «انضم إلينا الآن»)؛ إن تُرك فارغًا بقي «قدّم الآن».
-- • تُعاد دالة المزامنة nom_banner_sync (من nominations_6.sql) لتأخذ النص منه.
-- • إعلان المركز الإعلامي المنشور يأخذ «انضم إلينا الآن» فورًا.
-- يُنفَّذ بعد nominations_6.sql في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
alter table public.nom_calls add column if not exists banner_label text;

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
          '{student,guardian}', case when new.grades @> '{1,2,3}' then '{}' else new.grades end,
          case when v_res then v_day else new.opens_on end,
          case when v_res then v_day + 4 else new.closes_on end, new.id)
  on conflict (nom_call_id) do update set kind = excluded.kind, title = excluded.title, body = excluded.body,
    image_path = excluded.image_path, link_label = excluded.link_label, grades = excluded.grades,
    starts_on = excluded.starts_on, ends_on = excluded.ends_on;
  return new;
end $$;
drop trigger if exists nom_banner_sync on public.nom_calls;
create trigger nom_banner_sync after insert or update of home_banner, banner_label, published, cancelled_at, results_at, title, body,
  banner_image, grades, opens_on, closes_on on public.nom_calls
  for each row execute function public.nom_banner_sync();
revoke all on function public.nom_banner_sync() from public, anon;

update public.nom_calls set banner_label = 'انضم إلينا الآن'
 where coalesce(banner_label, '') = '' and (unit = 'المركز الإعلامي' or title like '%المركز الإعلامي%');

-- للتحقق
select c.title as "الإعلان", b.link_label as "نص الزر"
  from public.nom_calls c join public.home_banners b on b.nom_call_id = c.id
 order by c.created_at desc limit 5;
-- نهاية الجزء 8
