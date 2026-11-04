-- =====================================================================
-- سجل الإشراف اليومي (4 نوفمبر 2026): المشرف المتابع يسجل حضور المعلمين المشرفين معه في يومه
-- (الأصل حاضر) وملاحظة لكل عضو وملاحظاته، ثم يعتمده فيُقفل ويصير تقرير ذلك اليوم.
-- يقرؤه المشرف المتابع ليومه، والمدير والدعم الفني ووكلاء الشؤون التعليمية والمدرسية وشؤون الطلاب.
-- بعد الاعتماد لا يعدّله إلا المدير والدعم الفني. تكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.supervision_log (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  day_of_week int not null check (day_of_week between 1 and 5),
  members jsonb not null default '[]',        -- [{ user_id, name, status: present|absent|late|excused, note }]
  note text,                                  -- ملاحظات المشرف المتابع
  status text not null default 'draft' check (status in ('draft', 'approved')),
  supervisor_id uuid default auth.uid(), supervisor_name text,
  approved_at timestamptz, approved_by uuid, approved_by_name text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists supervision_log_date on public.supervision_log (log_date desc);

-- يوم الأسبوع من التاريخ: الأحد 1 … الخميس 5
create or replace function public.sup_dow(d date) returns int language sql immutable as $$
  select extract(dow from d)::int + 1 $$;

-- المشرف المتابع لهذا اليوم من جدول الإشراف
create or replace function public.sup_follower(p_dow int) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from supervision_duty where day_of_week = p_dow and kind = 'supervisor' and user_id = auth.uid());
$$;
create or replace function public.sup_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['principal', 'tech_support', 'deputy_academic', 'deputy_school', 'deputy_students']);
$$;
create or replace function public.sup_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['principal', 'tech_support']);
$$;

-- تثبيت اليوم من التاريخ، والاعتماد باسم من اعتمد، ومنع تعديل المعتمد إلا للمدير والدعم الفني
create or replace function public.supervision_log_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.day_of_week := public.sup_dow(new.log_date);
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.supervisor_id := auth.uid();
    new.supervisor_name := (select full_name from users where id = auth.uid());
  elsif old.status = 'approved' and not public.sup_editor() then
    raise exception 'سجل الإشراف معتمد، فلا يُعدَّل';
  end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    new.approved_at := now(); new.approved_by := auth.uid();
    new.approved_by_name := (select full_name from users where id = auth.uid());
  elsif new.status = 'draft' then
    new.approved_at := null; new.approved_by := null; new.approved_by_name := null;
  end if;
  return new;
end $$;
drop trigger if exists supervision_log_trg on public.supervision_log;
create trigger supervision_log_trg before insert or update on public.supervision_log
  for each row execute function public.supervision_log_trg();

alter table public.supervision_log enable row level security;
drop policy if exists sup_log_read on public.supervision_log;
create policy sup_log_read on public.supervision_log for select to authenticated
  using (public.sup_follower(day_of_week) or public.sup_manager());
drop policy if exists sup_log_insert on public.supervision_log;
create policy sup_log_insert on public.supervision_log for insert to authenticated
  with check ((public.sup_follower(public.sup_dow(log_date)) and log_date <= current_date) or public.sup_editor());
drop policy if exists sup_log_update on public.supervision_log;
create policy sup_log_update on public.supervision_log for update to authenticated
  using ((public.sup_follower(day_of_week) and status = 'draft') or public.sup_editor())
  with check (public.sup_follower(day_of_week) or public.sup_editor());
drop policy if exists sup_log_delete on public.supervision_log;
create policy sup_log_delete on public.supervision_log for delete to authenticated using (public.sup_editor());
grant select, insert, update, delete on public.supervision_log to authenticated;
-- نهاية الجزء 1
