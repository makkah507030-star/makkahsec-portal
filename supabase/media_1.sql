-- =====================================================================
-- استوديو الوسائط ومعرض المدرسة (الجزء 1): صور المدرسة ومقاطعها داخل الحسابات فقط.
-- • media_items: الصورة أو المقطع بعنوانه وألبومه ولمن يظهر (الطلاب، أولياء الأمور،
--   المنسوبون) وفي أي صفوف، وإقرار الرافع بموافقات التصوير.
-- • مخزن media-library خاص: لا رابط عام لأي ملف؛ يُعرض برابط موقّع ينتهي بعد دقائق،
--   ولا يُصدَر الرابط إلا لمن يحق له رؤية المادة (banner_for_me من home_banners.sql).
-- • صلاحية «استوديو الوسائط» (media) تُسند لدور «البوابة الإعلامية» هنا، والمدير والدعم الفني دائمًا.
-- يُنفَّذ بعد home_banners.sql في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('photo', 'video')),
  title text not null check (length(trim(title)) > 0),
  body text,
  album text,
  path text not null unique,                    -- الملف في media-library
  thumb text,                                   -- المصغّرة
  size bigint,
  audience text[] not null default '{student,guardian,staff}',
  grades int[] not null default '{}',           -- فارغ = كل الصفوف
  consent boolean not null check (consent),     -- أقرّ الرافع بموافقات التصوير لمن ظهر
  published boolean not null default true,
  created_by uuid default auth.uid(), created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists media_items_album on public.media_items (album, created_at desc);

create or replace function public.media_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_permission('media');
$$;
-- هل يرى المستخدم الحالي المادة: مديرها، أو منشورة لفئته وصفّه
create or replace function public.media_can_see(p_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.media_manager() or exists (
    select 1 from media_items m where (m.path = p_path or m.thumb = p_path)
       and m.published and public.banner_for_me(m.audience, m.grades));
$$;

alter table public.media_items enable row level security;
drop policy if exists media_items_read on public.media_items;
create policy media_items_read on public.media_items for select to authenticated
  using (public.media_manager() or (published and public.banner_for_me(audience, grades)));
drop policy if exists media_items_write on public.media_items;
create policy media_items_write on public.media_items for all to authenticated
  using (public.media_manager()) with check (public.media_manager());

insert into public.role_permissions (role_type, permission)
values ('media_portal', 'media') on conflict do nothing;

-- المخزن الخاص: حتى 50 ميجا للملف (حد الرفع الافتراضي في Supabase)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media-library', 'media-library', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "media library read" on storage.objects;
create policy "media library read" on storage.objects for select to authenticated
  using (bucket_id = 'media-library' and public.media_can_see(name));
drop policy if exists "media library write" on storage.objects;
create policy "media library write" on storage.objects for insert to authenticated
  with check (bucket_id = 'media-library' and public.media_manager());
drop policy if exists "media library delete" on storage.objects;
create policy "media library delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media-library' and public.media_manager());

revoke all on function public.media_manager(), public.media_can_see(text) from public, anon;
grant execute on function public.media_manager(), public.media_can_see(text) to authenticated;

-- للتحقق
select count(*) as "المواد",
       exists (select 1 from storage.buckets where id = 'media-library' and not public) as "مخزن خاص",
       exists (select 1 from public.role_permissions where role_type = 'media_portal' and permission = 'media') as "الصلاحية مسندة"
  from public.media_items;
-- نهاية الجزء 1
