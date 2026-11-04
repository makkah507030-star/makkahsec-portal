-- =====================================================================
-- حملة تحديث جوال ولي الأمر: يؤكد ولي الأمر رقمه أو يعدّله من البوابة مرة كل فصل دراسي،
-- وتتابع الإدارة والموجهون النسب والقوائم، وتعدّل الرقم يدويًا، وتعلّم ما حُدّث في نور.
-- تكرار تنفيذه آمن.
-- =====================================================================

alter table public.guardians add column if not exists mobile_confirmed_at   timestamptz;
alter table public.guardians add column if not exists mobile_confirmed_term text;   -- العام-الفصل
alter table public.guardians add column if not exists mobile_prev           text;
alter table public.guardians add column if not exists mobile_changed_at     timestamptz;
alter table public.guardians add column if not exists mobile_changed_by     text;
alter table public.guardians add column if not exists noor_updated_at       timestamptz;

create or replace function public.gm_term() returns text language sql stable security definer set search_path = public as $$
  select coalesce((select value from settings where key = 'active_year'), '') || '-' ||
         coalesce((select value from settings where key = 'active_term'), '1');
$$;
-- 05xxxxxxxx من أي صيغة (+9665… أو 9665… أو 5…)، أو null إن لم يكن جوالًا سعوديًا
create or replace function public.gm_norm(p text) returns text language sql immutable as $$
  select case when d ~ '^9665\d{8}$' then '0' || substr(d, 4) when d ~ '^05\d{8}$' then d
              when d ~ '^5\d{8}$' then '0' || d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') d) x;
$$;

-- ولي الأمر: رقمه وهل يُطلب منه التأكيد هذا الفصل
create or replace function public.gm_my_status()
returns table (mobile text, confirmed_at timestamptz, needs boolean)
language sql stable security definer set search_path = public as $$
  select g.mobile, g.mobile_confirmed_at, coalesce(g.mobile_confirmed_term, '') <> public.gm_term()
  from guardians g where g.user_id = auth.uid() and g.is_active order by g.created_at limit 1;
$$;

-- ولي الأمر: تأكيد الرقم (p_mobile فارغ) أو تعديله
create or replace function public.gm_confirm(p_mobile text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v text := public.gm_norm(p_mobile);
begin
  if p_mobile is not null and v is null then raise exception 'رقم الجوال غير صحيح، اكتبه بصيغة 05xxxxxxxx'; end if;
  update guardians g set
    mobile_prev = case when v is not null and v is distinct from public.gm_norm(g.mobile) then g.mobile else g.mobile_prev end,
    mobile_changed_at = case when v is not null and v is distinct from public.gm_norm(g.mobile) then now() else g.mobile_changed_at end,
    mobile_changed_by = case when v is not null and v is distinct from public.gm_norm(g.mobile) then 'ولي الأمر' else g.mobile_changed_by end,
    noor_updated_at = case when v is not null and v is distinct from public.gm_norm(g.mobile) then null else g.noor_updated_at end,
    mobile = coalesce(v, g.mobile), mobile_confirmed_at = now(), mobile_confirmed_term = public.gm_term()
  where g.user_id = auth.uid() and g.is_active;
  return coalesce(v, (select mobile from guardians where user_id = auth.uid() and is_active limit 1));
end $$;

-- الإدارة والكتّاب بالصفوف كلها، والموجه الطلابي بصفه: كل طالب نشط وولي أمره الأساسي وحالة رقمه
create or replace function public.gm_grades() returns int[] language sql stable security definer set search_path = public as $$
  select case
    when public.has_admin_role(array['principal', 'deputy_students', 'tech_support', 'clerk', 'clerk_2']) then array[1, 2, 3]
    else array(select g from unnest(array[1, 2, 3]) g where public.has_admin_role(array['counselor_' || g])) end;
$$;

create or replace function public.gm_campaign()
returns table (student_id uuid, full_name text, grade int, class_no int, guardian_id uuid, guardian_name text, mobile text,
               valid boolean, has_account boolean, last_login timestamptz, confirmed boolean, confirmed_at timestamptz,
               mobile_prev text, changed_at timestamptz, changed_by text, noor_updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select v.student_id, v.full_name, v.grade, v.class_no, g.id, g.full_name, g.mobile, public.gm_norm(g.mobile) is not null,
         g.user_id is not null, u.last_login, coalesce(g.mobile_confirmed_term, '') = public.gm_term(), g.mobile_confirmed_at,
         g.mobile_prev, g.mobile_changed_at, g.mobile_changed_by, g.noor_updated_at
  from v_active_students v
  left join lateral (select gd.* from guardian_student gs join guardians gd on gd.id = gs.guardian_id
                     where gs.student_id = v.student_id and gd.is_active order by gs.is_primary desc, gd.created_at limit 1) g on true
  left join users u on u.id = g.user_id
  where v.grade = any (public.gm_grades())
  order by v.grade, v.class_no, v.full_name;
$$;

-- الإدارة: تعديل الرقم يدويًا بعد التأكد هاتفيًا (p_mobile)، أو تعليم أنه حُدّث في نور (p_noor)
create or replace function public.gm_admin_set(p_guardian uuid, p_mobile text default null, p_noor boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v text := public.gm_norm(p_mobile);
begin
  if not exists (select 1 from guardian_student gs join v_active_students s on s.student_id = gs.student_id
                 where gs.guardian_id = p_guardian and s.grade = any (public.gm_grades())) then
    raise exception 'لا تملك صلاحية هذا الإجراء' using errcode = '42501';
  end if;
  if p_noor then update guardians set noor_updated_at = now() where id = p_guardian; return; end if;
  if v is null then raise exception 'رقم الجوال غير صحيح، اكتبه بصيغة 05xxxxxxxx'; end if;
  -- الرقم نفسه بعد التأكد هاتفيًا يُعدّ تأكيدًا فقط
  update guardians g set mobile_confirmed_at = now(), mobile_confirmed_term = public.gm_term(),
    mobile = case when v = public.gm_norm(g.mobile) then v else g.mobile end where g.id = p_guardian;
  update guardians g set mobile_prev = g.mobile, mobile = v, mobile_changed_at = now(), noor_updated_at = null,
    mobile_changed_by = public.sa_my_name()
  where g.id = p_guardian and v is distinct from g.mobile;
end $$;

revoke execute on function public.gm_my_status(), public.gm_confirm(text), public.gm_campaign(), public.gm_admin_set(uuid, text, boolean) from public, anon;
grant execute on function public.gm_my_status(), public.gm_confirm(text), public.gm_campaign(), public.gm_admin_set(uuid, text, boolean) to authenticated;

-- نهاية الجزء 1
