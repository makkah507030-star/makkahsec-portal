-- =====================================================================
-- معمل الحاسب الآلي (4): بلاغات أعطال الأجهزة — يرفعها معلم التقنية (من رمز QR
-- على خلفية سطح مكتب الجهاز أو من البوابة)، ويتابعها محضر المعمل حتى تُحل،
-- وتتبعها حالة الجهاز تلقائيًا. يُنفَّذ بعد الأجزاء 1-3. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.lab_tickets (
  id bigint generated always as identity primary key,
  lab_id smallint not null references public.labs(id),
  seat_no integer not null,
  category text not null,
  description text,
  stopped boolean not null default false,      -- الجهاز متوقف عن العمل كليًا
  status text not null default 'new' check (status in ('new', 'in_progress', 'external', 'resolved')),
  reported_by uuid not null default auth.uid(),
  reporter_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolution text,
  handled_by uuid
);
create index if not exists lab_tickets_open on public.lab_tickets (lab_id, status, seat_no);
alter table public.lab_tickets enable row level security;
drop policy if exists "lab tickets read" on public.lab_tickets;
create policy "lab tickets read" on public.lab_tickets for select to authenticated using (public.lab_can_view());

-- رفع بلاغ: الجهاز المتوقف يصير «معطّل» مباشرة
create or replace function public.lab_ticket_open(
  p_lab smallint, p_seat integer, p_category text, p_desc text default null, p_stopped boolean default false)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not (public.lab_can_book() or public.lab_is_manager()) then raise exception 'غير مخوّل برفع بلاغ'; end if;
  if not exists (select 1 from public.lab_devices where lab_id = p_lab and seat_no = p_seat) then
    raise exception 'الجهاز غير موجود';
  end if;
  insert into public.lab_tickets (lab_id, seat_no, category, description, stopped, reporter_name)
  values (p_lab, p_seat, p_category, nullif(trim(p_desc), ''), coalesce(p_stopped, false),
          (select full_name from public.users where id = auth.uid()))
  returning id into v_id;
  if p_stopped then
    update public.lab_devices set status = 'broken', updated_at = now(), updated_by = auth.uid()
     where lab_id = p_lab and seat_no = p_seat and status = 'ok';
  end if;
  return v_id;
end $$;

-- متابعة البلاغ (لمسؤولي المعمل): الصيانة الخارجية تجعل الجهاز «في الصيانة»،
-- والحل يعيده «يعمل» إن لم يبقَ له بلاغ مفتوح. يعيد صاحب البلاغ لإشعاره.
create or replace function public.lab_ticket_update(p_id bigint, p_status text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare t public.lab_tickets;
begin
  if not public.lab_is_manager() then raise exception 'المتابعة لمسؤول المعمل'; end if;
  update public.lab_tickets
     set status = p_status, resolution = coalesce(nullif(trim(p_note), ''), resolution),
         updated_at = now(), handled_by = auth.uid()
   where id = p_id returning * into t;
  if not found then raise exception 'البلاغ غير موجود'; end if;
  if p_status = 'external' then
    update public.lab_devices set status = 'maintenance', updated_at = now(), updated_by = auth.uid()
     where lab_id = t.lab_id and seat_no = t.seat_no;
  elsif p_status = 'resolved' and not exists (
      select 1 from public.lab_tickets x where x.lab_id = t.lab_id and x.seat_no = t.seat_no
         and x.status <> 'resolved') then
    update public.lab_devices set status = 'ok', updated_at = now(), updated_by = auth.uid()
     where lab_id = t.lab_id and seat_no = t.seat_no;
  end if;
  return t.reported_by;
end $$;

-- حسابات محضر معمل الحاسب الآلي (لإشعاره بالبلاغ الجديد)
create or replace function public.lab_manager_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select ar.user_id from public.admin_roles ar join public.users u on u.id = ar.user_id
   where ar.role_type = 'computer_lab' and u.is_active and public.lab_can_view();
$$;

revoke execute on function public.lab_ticket_open(smallint, integer, text, text, boolean),
  public.lab_ticket_update(bigint, text, text), public.lab_manager_ids() from public, anon;
grant execute on function public.lab_ticket_open(smallint, integer, text, text, boolean),
  public.lab_ticket_update(bigint, text, text), public.lab_manager_ids() to authenticated;
-- نهاية الجزء 4
