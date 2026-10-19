-- الأدوار المخصّصة (2 من 2): اسم كل دور مخصّص، وتفعيل الحسابات الإدارية وتعطيلها.

create table if not exists public.custom_roles (
  role_type  public.admin_role_type primary key,
  label      text not null check (length(trim(label)) between 2 and 60),
  external   boolean not null default false,   -- من خارج المدرسة (مثل القائد الكشفي)
  note       text,
  created_at timestamptz not null default now()
);
alter table public.custom_roles enable row level security;

-- الأسماء تُقرأ في كل البوابة (شارات الأدوار وأغلفة الأخبار)
drop policy if exists custom_roles_read on public.custom_roles;
create policy custom_roles_read on public.custom_roles for select to authenticated using (true);

-- الإضافة والتعديل للمدير والدعم الفني، وفي الخانات المخصّصة وحدها
drop policy if exists custom_roles_write on public.custom_roles;
create policy custom_roles_write on public.custom_roles for all to authenticated
  using (public.has_admin_role(array['principal', 'tech_support']))
  with check (public.has_admin_role(array['principal', 'tech_support']) and role_type::text like 'custom\_%');

-- تفعيل حساب إداري أو تعطيله: للمدير والدعم الفني ومن له صلاحية «الإدارة»
create or replace function public.admin_set_active(p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('staff') then
    raise exception 'غير مصرّح: التفعيل لمن له صلاحية «الإدارة»';
  end if;
  if p_user = auth.uid() then
    raise exception 'لا يمكنك تعطيل حسابك';
  end if;
  if exists (select 1 from public.admin_roles where user_id = p_user and role_type in ('principal', 'tech_support'))
     and not public.has_admin_role(array['principal', 'tech_support']) then
    raise exception 'تعطيل حساب المدير أو الدعم الفني لهما وحدهما';
  end if;
  update public.users set is_active = coalesce(p_active, true)
   where id = p_user and role = 'admin';
  if not found then raise exception 'الحساب ليس حسابًا إداريًا'; end if;
end;
$$;
revoke execute on function public.admin_set_active(uuid, boolean) from public, anon;
grant  execute on function public.admin_set_active(uuid, boolean) to authenticated;

-- للتحقق
select count(*) as custom_roles from public.custom_roles;
-- نهاية الجزء 2
