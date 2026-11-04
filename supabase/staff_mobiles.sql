-- =====================================================================
-- جوالات الإداريين (4 نوفمبر 2026): جوال المعلم في بيانات المعلمين (teachers.mobile)، ولا خانة للإداري،
-- فلم يظهر له «تذكير واتساب» في المناوبة والإشراف. الآن staff_contacts لجوال الإداري، يعدّله من له صلاحية
-- «الإدارة المدرسية» من صفحة الأعضاء، ويراه صاحبه. وstaff_mobile يعيد جوال الموظف من أيٍّ منهما.
-- يحل محل duty_mobiles (duty_log_1.sql) وsupervision_mobiles (supervision_whatsapp.sql). تكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.staff_contacts (
  user_id uuid primary key references public.users(id) on delete cascade,
  mobile text check (mobile is null or mobile ~ '^05[0-9]{8}$'),
  updated_at timestamptz not null default now(), updated_by uuid default auth.uid()
);
alter table public.staff_contacts enable row level security;
drop policy if exists staff_contacts_read on public.staff_contacts;
create policy staff_contacts_read on public.staff_contacts for select to authenticated
  using (user_id = auth.uid() or public.has_permission('staff'));
drop policy if exists staff_contacts_write on public.staff_contacts;
create policy staff_contacts_write on public.staff_contacts for all to authenticated
  using (public.has_permission('staff')) with check (public.has_permission('staff'));
grant select, insert, update, delete on public.staff_contacts to authenticated;

-- جوال الموظف: الإداري من staff_contacts، وإلا المعلم من بيانات المعلمين
create or replace function public.staff_mobile(p_uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif((select mobile from staff_contacts where user_id = p_uid), ''),
                  nullif((select t.mobile from teachers t where t.user_id = p_uid and coalesce(t.mobile, '') <> '' limit 1), ''));
$$;
revoke all on function public.staff_mobile(uuid) from public, anon, authenticated;

-- المشرف المتابع: جوالات المعلمين المشرفين في يومه
create or replace function public.supervision_mobiles(p_dow int)
returns table (user_id uuid, mobile text)
language sql stable security definer set search_path = public as $$
  select sd.user_id, public.staff_mobile(sd.user_id) from supervision_duty sd
   where sd.day_of_week = p_dow and sd.kind = 'teacher' and sd.user_id is not null and public.staff_mobile(sd.user_id) is not null
     and exists (select 1 from supervision_duty me where me.user_id = auth.uid() and me.day_of_week = p_dow and me.kind = 'supervisor');
$$;
revoke execute on function public.supervision_mobiles(int) from public, anon;
grant execute on function public.supervision_mobiles(int) to authenticated, service_role;

-- المناوبة: جوالات المناوبين للوكيل والإدارة، وللمناوب عن زميله
create or replace function public.duty_mobiles(p_date date)
returns table (user_id uuid, mobile text)
language sql stable security definer set search_path = public as $$
  select u, public.staff_mobile(u) from duty_roster r cross join lateral unnest(array[r.user_a, r.user_b]) u
   where r.duty_date = p_date and u is not null and public.staff_mobile(u) is not null
     and (public.duty_approver() or public.duty_person(p_date));
$$;
revoke execute on function public.duty_mobiles(date) from public, anon;
grant execute on function public.duty_mobiles(date) to authenticated;
-- نهاية الجزء 1
