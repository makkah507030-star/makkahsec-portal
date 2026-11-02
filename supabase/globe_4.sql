-- =====================================================================
-- برنامج جلوب (الجزء 4) — بعد الجزء 3: دخول الطلاب الأعضاء للعمل على ما كُلّفوا به.
-- • globe_members.portal: أسند المشرف للطالب الدخول إلى «برنامج جلوب» في حسابه.
-- • globe_members.tasks: البروتوكولات المكلّف بها (من البروتوكولات العشرة).
-- • globe_my(): ما يراه الطالب: صفته ومهامه وجلسات الرصد المكلّف بها (باسمه أو ببروتوكوله).
-- • globe_obs_save(): يوثّق الطالب جلسة حلّ موعدها: القراءات، ورفعها إلى GLOBE، والصور (حتى 3).
-- • الصور في globe-files/observations/<الجلسة>/ لجلساته وحدها.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
alter table public.globe_members add column if not exists portal boolean not null default false;
alter table public.globe_members add column if not exists tasks text[] not null default '{}';
alter table public.globe_observations add column if not exists documented_by_name text;

-- عضوية الطالب صاحب الحساب إن أُسند له الدخول
create or replace function public.globe_me() returns public.globe_members
language sql stable security definer set search_path = public as $$
  select m.* from globe_members m join students s on s.id = m.student_id
   where s.user_id = auth.uid() and m.portal limit 1;
$$;

-- الجلسة من مهام الطالب: باسمه فيها أو ببروتوكول مكلّف به، وليست ملغاة
create or replace function public.globe_can_obs(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from globe_observations o, globe_me() m
    where o.id = p_id and m.student_id is not null and o.status <> 'cancelled'
      and (m.student_id = any(o.student_ids) or o.protocol = any(m.tasks)));
$$;

create or replace function public.globe_my() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m globe_members; v_today date := (now() at time zone 'Asia/Riyadh')::date;
begin
  select * into m from globe_me();
  if m.student_id is null then return null; end if;
  return jsonb_build_object('role', m.role, 'tasks', m.tasks, 'today', v_today,
    'name', (select full_name from students where id = m.student_id),
    'sessions', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'sphere', o.sphere, 'protocol', o.protocol,
        'obs_date', o.obs_date, 'obs_time', o.obs_time, 'place', o.place, 'status', o.status, 'readings', o.readings,
        'uploaded', o.uploaded, 'photos', o.photos, 'documented_by_name', o.documented_by_name,
        'mine', m.student_id = any(o.student_ids)) order by o.obs_date, o.obs_time), '[]')
      from globe_observations o
     where o.status <> 'cancelled' and (m.student_id = any(o.student_ids) or o.protocol = any(m.tasks))
       and o.obs_date between v_today - 60 and v_today + 30));
end $$;

create or replace function public.globe_obs_save(p_id uuid, p_readings text, p_uploaded boolean, p_photos text[])
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_today date := (now() at time zone 'Asia/Riyadh')::date;
begin
  if not public.globe_can_obs(p_id) then raise exception 'هذه الجلسة ليست من مهامك'; end if;
  if (select obs_date from globe_observations where id = p_id) > v_today then raise exception 'لم يحلّ موعد الجلسة بعد'; end if;
  if coalesce(array_length(p_photos, 1), 0) > 3
     or exists (select 1 from unnest(coalesce(p_photos, '{}')) ph where ph not like 'observations/' || p_id || '/%') then
    raise exception 'الصور غير صحيحة';
  end if;
  select s.full_name into v_name from globe_me() m join students s on s.id = m.student_id;
  update globe_observations set readings = nullif(trim(p_readings), ''), uploaded = coalesce(p_uploaded, false),
         photos = coalesce(p_photos, '{}'), status = 'done', documented_by_name = v_name
   where id = p_id;
end $$;

revoke all on function public.globe_me(), public.globe_can_obs(uuid), public.globe_my(),
  public.globe_obs_save(uuid, text, boolean, text[]) from public, anon;
grant execute on function public.globe_me(), public.globe_can_obs(uuid), public.globe_my(),
  public.globe_obs_save(uuid, text, boolean, text[]) to authenticated;

-- صور الطالب لجلساته وحدها (المسار يُفحص قبل تحويله إلى معرّف)
create or replace function public.globe_can_obs_path(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare f text[] := storage.foldername(p_name);
begin
  if f[1] is distinct from 'observations' or coalesce(f[2], '') !~ '^[0-9a-f]{8}-[0-9a-f-]{27}$' then return false; end if;
  return public.globe_can_obs(f[2]::uuid);
end $$;
revoke all on function public.globe_can_obs_path(text) from public, anon;
grant execute on function public.globe_can_obs_path(text) to authenticated;

drop policy if exists "globe student photos" on storage.objects;
create policy "globe student photos" on storage.objects for all to authenticated
  using (bucket_id = 'globe-files' and public.globe_can_obs_path(name))
  with check (bucket_id = 'globe-files' and public.globe_can_obs_path(name));

-- للتحقق
select count(*) filter (where portal) as "طلاب لهم دخول", count(*) as "طلاب البرنامج" from public.globe_members;
-- نهاية الجزء 4
