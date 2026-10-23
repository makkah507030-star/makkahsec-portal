-- =====================================================================
-- إعلانات الرئيسية: بطاقات مصوّرة للفرص والمناسبات تظهر أعلى رئيسية الطالب وولي الأمر
-- (والمنسوبين إن اختيروا)، بمدة عرض وصفوف محددة. يديرها من له صلاحية «إعلانات الرئيسية»
-- (role_permissions: banners) مع المدير والدعم الفني. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.home_banners (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'opportunity' check (kind in ('opportunity', 'event', 'general')),
  title text not null check (length(trim(title)) > 0),
  body text,
  image_path text,
  link text,                                   -- مسار في البوابة (/opportunities) أو رابط خارجي
  link_label text,
  audience text[] not null default '{student,guardian}',   -- student | guardian | staff
  grades int[] not null default '{}',          -- فارغ = كل الصفوف
  starts_on date not null default current_date,
  ends_on date,
  is_active boolean not null default true,
  sort int not null default 0,
  created_by uuid default auth.uid(),
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists home_banners_live on public.home_banners (is_active, starts_on, ends_on);

create or replace function public.banners_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_permission('banners');
$$;

-- هل الإعلان للمستخدم الحالي: فئته ضمن المستهدفين، وصفّه (أو صف أحد أبنائه) ضمن الصفوف
create or replace function public.banner_for_me(p_audience text[], p_grades int[]) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare r text; g int[];
begin
  select case when u.role::text in ('admin', 'teacher') then 'staff' else u.role::text end into r
    from users u where u.id = auth.uid();
  if r is null or not (r = any(p_audience)) then return false; end if;
  if r = 'staff' or coalesce(cardinality(p_grades), 0) = 0 then return true; end if;
  if r = 'student' then
    select array_agg(v.grade) into g from v_active_students v join students s on s.id = v.student_id where s.user_id = auth.uid();
  else
    select array_agg(v.grade) into g from guardians gd join guardian_student gs on gs.guardian_id = gd.id
      join v_active_students v on v.student_id = gs.student_id where gd.user_id = auth.uid();
  end if;
  return coalesce(g && p_grades, false);
end $$;

create or replace function public.home_banners_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_by_name := (select full_name from users where id = auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists home_banners_trg on public.home_banners;
create trigger home_banners_trg before insert on public.home_banners
  for each row execute function public.home_banners_trg();

alter table public.home_banners enable row level security;
drop policy if exists home_banners_manage on public.home_banners;
create policy home_banners_manage on public.home_banners for all to authenticated
  using (public.banners_manager()) with check (public.banners_manager());
drop policy if exists home_banners_read on public.home_banners;
create policy home_banners_read on public.home_banners for select to authenticated
  using (is_active and starts_on <= current_date and (ends_on is null or ends_on >= current_date)
         and public.banner_for_me(audience, grades));
grant select, insert, update, delete on public.home_banners to authenticated;
revoke all on function public.banners_manager(), public.banner_for_me(text[], int[]) from public, anon;
grant execute on function public.banners_manager(), public.banner_for_me(text[], int[]) to authenticated;

-- صور الإعلانات: مخزن عام للقراءة (صور إعلانية)، والرفع والحذف لمدير الإعلانات
insert into storage.buckets (id, name, public, file_size_limit)
values ('home-banners', 'home-banners', true, 5242880) on conflict (id) do nothing;
drop policy if exists "home banners add" on storage.objects;
create policy "home banners add" on storage.objects for insert to authenticated
  with check (bucket_id = 'home-banners' and public.banners_manager());
drop policy if exists "home banners delete" on storage.objects;
create policy "home banners delete" on storage.objects for delete to authenticated
  using (bucket_id = 'home-banners' and public.banners_manager());
-- نهاية الجزء 1
