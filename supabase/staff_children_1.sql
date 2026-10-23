-- =====================================================================
-- أبناء المعلمين والإداريين: ربط سجل ولي الأمر (من نور) بحساب الموظف نفسه، فيتابع أبناءه
-- من واجهة «أبنائي» في حسابه بدل حساب ولي أمر منفصل. الصلاحيات كلها تمر بـ guardians.user_id
-- فلا يتغير شيء في قواعد الوصول. للمدير والدعم الفني ووكيل شؤون الطلاب. تكرار التنفيذ آمن.
-- =====================================================================

-- ربط: سجل ولي الأمر يصير لحساب الموظف. إن كان للموظف سجل ولي أمر من قبل تُنقل إليه روابط الأبناء.
-- حساب ولي الأمر القديم (إن وُجد ولم يعد له سجل) يُعطَّل، فلا يبقى للشخص حسابان.
create or replace function public.staff_link_children(p_guardian uuid, p_staff uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text; v_old uuid; v_mine uuid; v_kids int;
begin
  if not public.has_admin_role(array['principal', 'tech_support', 'deputy_students']) then
    raise exception 'غير مصرّح'; end if;
  select role::text into v_role from users where id = p_staff and is_active;
  if v_role is null or v_role not in ('teacher', 'admin') then raise exception 'الحساب ليس معلمًا ولا إداريًا نشطًا'; end if;
  select user_id into v_old from guardians where id = p_guardian;
  if not found then raise exception 'سجل ولي الأمر غير موجود'; end if;
  if v_old = p_staff then return jsonb_build_object('ok', true, 'already', true); end if;
  select id into v_mine from guardians where user_id = p_staff;

  if v_mine is not null then          -- للموظف سجل من قبل: تُنقل إليه روابط الأبناء، ويُوقف السجل الآخر
    insert into guardian_student (guardian_id, student_id)
    select v_mine, gs.student_id from guardian_student gs where gs.guardian_id = p_guardian
    on conflict do nothing;
    update guardians set is_active = false where id = p_guardian;
  else
    update guardians set user_id = p_staff, is_active = true where id = p_guardian;
  end if;
  -- حساب ولي الأمر القديم يُعطَّل إن لم يبق له سجل
  if v_old is not null and not exists (select 1 from guardians where user_id = v_old) then
    update users set is_active = false where id = v_old and role = 'guardian';
  end if;
  select count(*) into v_kids from guardian_student where guardian_id = coalesce(v_mine, p_guardian);
  return jsonb_build_object('ok', true, 'children', v_kids, 'old_account_disabled', v_old is not null);
end $$;

-- فك الربط: يعود السجل بلا حساب، فيُنشأ له حساب ولي أمر من «إنشاء الحسابات» إن احتيج
create or replace function public.staff_unlink_children(p_guardian uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role(array['principal', 'tech_support', 'deputy_students']) then
    raise exception 'غير مصرّح'; end if;
  update guardians g set user_id = null
   where g.id = p_guardian and exists (select 1 from users u where u.id = g.user_id and u.role::text in ('teacher', 'admin'));
end $$;

-- الموظفون المربوط بهم أبناؤهم: الموظف، ورقم سجل ولي الأمر، وأسماء الأبناء
create or replace function public.staff_children_list()
returns table (guardian_id uuid, staff_id uuid, staff_name text, mobile text, children text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role(array['principal', 'tech_support', 'deputy_students']) then
    raise exception 'غير مصرّح'; end if;
  return query
  select g.id, u.id, u.full_name::text, g.mobile::text,
         (select string_agg(s.full_name, '، ' order by s.full_name) from guardian_student gs
            join students s on s.id = gs.student_id where gs.guardian_id = g.id)::text
    from guardians g join users u on u.id = g.user_id
   where u.role::text in ('teacher', 'admin') and g.is_active
   order by u.full_name;
end $$;

revoke all on function public.staff_link_children(uuid, uuid), public.staff_unlink_children(uuid), public.staff_children_list() from public, anon;
grant execute on function public.staff_link_children(uuid, uuid), public.staff_unlink_children(uuid), public.staff_children_list() to authenticated;
-- نهاية الجزء 1
