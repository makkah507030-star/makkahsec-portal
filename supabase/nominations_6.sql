-- =====================================================================
-- الترشيحات (الجزء 6): ربط الإعلان بـ«إعلانات الرئيسية». يُشغَّل بعد الجزء 5 و home_banners.sql.
-- • خانة home_banner في الإعلان: تُنشأ بطاقته في رئيسية الطلاب وأولياء الأمور تلقائيًا،
--   لصفوف الإعلان ومن بداية التقديم إلى آخر موعده، وتتبع تعديلاته.
-- • عند إعلان النتائج تصير البطاقة «أُعلنت نتائج …» خمسة أيام (بلا أسماء) ثم تنتهي.
-- • تُحذف البطاقة إن أُخفي الإعلان أو أُلغي أو أُزيلت الخانة. ويبقى لمسؤول الإعلانات
--   إيقافها وترتيبها (لا تعيد المزامنة تفعيل بطاقة أوقفها).
-- • صورة البطاقة يرفعها صاحب الإعلان في home-banners/nom/.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
alter table public.nom_calls add column if not exists home_banner boolean not null default false;
alter table public.nom_calls add column if not exists banner_image text;
alter table public.home_banners add column if not exists nom_call_id uuid unique references public.nom_calls(id) on delete cascade;

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
          new.banner_image, '/opportunities', case when v_res then 'نتيجتي' else 'قدّم الآن' end,
          '{student,guardian}', case when new.grades @> '{1,2,3}' then '{}' else new.grades end,
          case when v_res then v_day else new.opens_on end,
          case when v_res then v_day + 4 else new.closes_on end, new.id)
  on conflict (nom_call_id) do update set kind = excluded.kind, title = excluded.title, body = excluded.body,
    image_path = excluded.image_path, link_label = excluded.link_label, grades = excluded.grades,
    starts_on = excluded.starts_on, ends_on = excluded.ends_on;
  return new;
end $$;
drop trigger if exists nom_banner_sync on public.nom_calls;
create trigger nom_banner_sync after insert or update of home_banner, published, cancelled_at, results_at, title, body,
  banner_image, grades, opens_on, closes_on on public.nom_calls
  for each row execute function public.nom_banner_sync();
revoke all on function public.nom_banner_sync() from public, anon;

-- صورة بطاقة الإعلان: يرفعها صاحب الإعلان ويحذفها في المجلد nom/ وحده
drop policy if exists "home banners nom add" on storage.objects;
create policy "home banners nom add" on storage.objects for insert to authenticated
  with check (bucket_id = 'home-banners' and (storage.foldername(name))[1] = 'nom' and public.nom_manager());
drop policy if exists "home banners nom delete" on storage.objects;
create policy "home banners nom delete" on storage.objects for delete to authenticated
  using (bucket_id = 'home-banners' and (storage.foldername(name))[1] = 'nom' and public.nom_manager());

-- للتحقق
select count(*) filter (where home_banner) as "إعلانات لها بطاقة",
       (select count(*) from public.home_banners where nom_call_id is not null) as "بطاقات الترشيحات"
  from public.nom_calls;
-- نهاية الجزء 6
