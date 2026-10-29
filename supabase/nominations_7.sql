-- =====================================================================
-- الترشيحات (الجزء 7): ترشّح المعلمين لقيادة الفريق في الإعلان نفسه.
-- • nom_calls.staff_lead: اسم دور القيادة (مثل «قائد الفريق الإعلامي»)؛ إن وُجد يرى المعلمون
--   الإعلان في رئيسيتهم ويترشّحون له بنبذة عن خبرتهم.
-- • nom_staff_apps: ترشّح المعلم وقرار صاحب الإعلان فيه (مقبول / معتذر).
-- يُنفَّذ بعد nominations_1..6.sql في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
alter table public.nom_calls add column if not exists staff_lead text;

create table if not exists public.nom_staff_apps (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.nom_calls(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  full_name text,
  note text,                                   -- نبذة المعلم عن خبرته وسبب ترشّحه
  stage text not null default 'applied' check (stage in ('applied', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (call_id, user_id)
);

alter table public.nom_staff_apps enable row level security;
drop policy if exists nom_staff_apps_read on public.nom_staff_apps;
create policy nom_staff_apps_read on public.nom_staff_apps for select to authenticated
  using (user_id = auth.uid() or public.nom_owns(call_id));
drop policy if exists nom_staff_apps_decide on public.nom_staff_apps;
create policy nom_staff_apps_decide on public.nom_staff_apps for update to authenticated
  using (public.nom_owns(call_id)) with check (public.nom_owns(call_id));

-- إعلانات القيادة المفتوحة للمعلم وترشّحه فيها
create or replace function public.nom_staff_calls()
returns table (id uuid, title text, unit text, body text, staff_lead text, closes_on date, owner_name text, stage text)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.unit, c.body, c.staff_lead, c.closes_on, c.owner_name, a.stage
    from nom_calls c
    left join nom_staff_apps a on a.call_id = c.id and a.user_id = auth.uid()
   where c.staff_lead is not null and c.published and c.cancelled_at is null
     and exists (select 1 from users u where u.id = auth.uid() and u.role in ('teacher', 'admin') and u.is_active)
     and (current_date between c.opens_on and c.closes_on or a.stage is not null)
     and c.owner_id <> auth.uid()
   order by c.closes_on;
$$;

-- ترشّح المعلم، أو انسحابه (p_note = null)
create or replace function public.nom_staff_apply(p_call uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare c nom_calls; nm text;
begin
  select * into c from nom_calls where id = p_call;
  if c.id is null or c.staff_lead is null or not c.published or c.cancelled_at is not null then raise exception 'الإعلان غير متاح'; end if;
  select full_name into nm from users where id = auth.uid() and role in ('teacher', 'admin') and is_active;
  if nm is null then raise exception 'الترشّح للمعلمين والإداريين'; end if;
  if exists (select 1 from nom_staff_apps where call_id = p_call and user_id = auth.uid() and stage in ('accepted', 'rejected')) then
    raise exception 'صدر القرار في ترشّحك'; end if;
  if p_note is null then
    update nom_staff_apps set stage = 'withdrawn' where call_id = p_call and user_id = auth.uid();
    return;
  end if;
  if current_date not between c.opens_on and c.closes_on then raise exception 'انتهت مدة الترشّح'; end if;
  insert into nom_staff_apps (call_id, user_id, full_name, note)
  values (p_call, auth.uid(), nm, nullif(trim(p_note), ''))
  on conflict (call_id, user_id) do update set note = excluded.note, stage = 'applied', full_name = excluded.full_name;
end $$;

revoke all on function public.nom_staff_calls(), public.nom_staff_apply(uuid, text) from public, anon;
grant execute on function public.nom_staff_calls(), public.nom_staff_apply(uuid, text) to authenticated;

-- للتحقق
select count(*) filter (where staff_lead is not null) as "إعلانات فيها قيادة",
       (select count(*) from public.nom_staff_apps) as "ترشّحات المعلمين"
  from public.nom_calls;
-- نهاية الجزء 7
