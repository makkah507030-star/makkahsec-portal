-- =====================================================================
-- صورة المعلم والإداري في بطاقة الاسم أعلى الرئيسية: يرفعها صاحبها بالضغط على الرمز.
-- مخزن عام للقراءة (صور شخصية تظهر داخل البوابة)، مجلد باسم المستخدم، يكتب فيه صاحبه
-- وحده إن كان معلمًا أو إداريًا. تكرار التنفيذ آمن.
-- =====================================================================
alter table public.users add column if not exists avatar_path text;

create or replace function public.is_staff_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from users where id = auth.uid() and role::text in ('admin', 'teacher'));
$$;

-- حفظ مسار الصورة (أو حذفه بـ null) لصاحب الحساب نفسه
create or replace function public.set_my_avatar(p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff_user() then raise exception 'الصورة للمعلمين والإداريين'; end if;
  if p_path is not null and p_path not like auth.uid()::text || '/%' then raise exception 'مسار غير صالح'; end if;
  update users set avatar_path = p_path where id = auth.uid();
end $$;
revoke all on function public.is_staff_user(), public.set_my_avatar(text) from public, anon;
grant execute on function public.is_staff_user(), public.set_my_avatar(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 2097152) on conflict (id) do nothing;
drop policy if exists "avatars add" on storage.objects;
create policy "avatars add" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.is_staff_user());
drop policy if exists "avatars delete" on storage.objects;
create policy "avatars delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
-- نهاية الجزء 1
