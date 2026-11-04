-- =====================================================================
-- سجل المناوبة اليومية (1 من 2، 4 نوفمبر 2026): المناوبون (من جدول المناوبة duty_roster) يسجلون بداية اليوم
-- ونهايته، والطلاب المتأخرين وسببه، والمواقف على الطلاب وملاحظاتهم، ثم يرفعونه للوكيل. والوكيل يسجل حضورهم
-- (الأصل حاضر) وملاحظة لكل منهم وملاحظاته ويعتمد، فيُقفل ويصير تقرير اليوم ويصل أولياء أمور المتأخرين تنبيه.
-- يعتمد: المدير والدعم الفني ووكيلا الشؤون المدرسية وشؤون الطلاب، ويقرأ معهم وكيل الشؤون التعليمية.
-- يُنفَّذ قبل duty_log_2.sql. تكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.duty_log (
  id uuid primary key default gen_random_uuid(),
  duty_date date not null unique,
  members jsonb not null default '[]',     -- المناوبون: [{ user_id, name, status: present|late|absent|excused, note }]
  start_note text, end_note text,          -- بداية اليوم ونهايته
  lates jsonb not null default '[]',       -- المتأخرون في الانصراف: [{ student_id, name, class_no, kind: pickup, time, reason }] (الصباحي مع البصمة)
  incidents jsonb not null default '[]',   -- [{ student_id, name, class_no, text }]
  duty_note text, deputy_note text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved')),
  created_by uuid default auth.uid(), created_by_name text, submitted_at timestamptz,
  approved_at timestamptz, approved_by uuid, approved_by_name text, notified_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists duty_log_date on public.duty_log (duty_date desc);

create or replace function public.duty_person(p_date date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from duty_roster where duty_date = p_date and auth.uid() in (user_a, user_b));
$$;
create or replace function public.duty_approver() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['principal', 'tech_support', 'deputy_academic', 'deputy_school', 'deputy_students']);
$$;
create or replace function public.duty_reader() returns boolean
language sql stable security definer set search_path = public as $$
  select public.duty_approver() or public.has_admin_role(array['deputy_academic']);
$$;

-- المناوب لا يغيّر حضور نفسه ولا ملاحظات الوكيل ولا يعتمد، ولا يعدّل بعد الرفع. والمعتمد للمدير والدعم الفني وحدهما
create or replace function public.duty_log_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare ap boolean := public.duty_approver(); nm text := (select full_name from users where id = auth.uid());
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := auth.uid(); new.created_by_name := nm; end if;
  if tg_op = 'UPDATE' and old.status = 'approved' and not public.has_admin_role(array['principal', 'tech_support']) then
    raise exception 'سجل المناوبة معتمد، فلا يُعدَّل';
  end if;
  if not ap then
    if tg_op = 'UPDATE' and old.status <> 'draft' then raise exception 'رُفع السجل للوكيل، فلا يُعدَّل'; end if;
    if new.status = 'approved' then raise exception 'الاعتماد للوكيل'; end if;
    new.deputy_note := case when tg_op = 'UPDATE' then old.deputy_note end;
    if tg_op = 'UPDATE' then new.members := old.members; end if;   -- حضور المناوبين يسجله الوكيل
  end if;
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status = 'draft') then new.submitted_at := now(); end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    new.approved_at := now(); new.approved_by := auth.uid(); new.approved_by_name := nm;
    -- تنبيه أولياء أمور المتأخرين مرة واحدة (duty_log_2.sql)
    if new.notified_at is null and jsonb_array_length(new.lates) > 0 then
      begin perform public.duty_notify_lates(new.duty_date, new.lates); new.notified_at := now();
      exception when undefined_function then null; end;
    end if;
  elsif new.status <> 'approved' then
    new.approved_at := null; new.approved_by := null; new.approved_by_name := null;
  end if;
  return new;
end $$;
drop trigger if exists duty_log_trg on public.duty_log;
create trigger duty_log_trg before insert or update on public.duty_log for each row execute function public.duty_log_trg();

alter table public.duty_log enable row level security;
drop policy if exists duty_log_read on public.duty_log;
create policy duty_log_read on public.duty_log for select to authenticated using (public.duty_person(duty_date) or public.duty_reader());
drop policy if exists duty_log_insert on public.duty_log;
create policy duty_log_insert on public.duty_log for insert to authenticated
  with check ((public.duty_person(duty_date) and duty_date <= current_date) or public.duty_approver());
drop policy if exists duty_log_update on public.duty_log;
create policy duty_log_update on public.duty_log for update to authenticated
  using ((public.duty_person(duty_date) and status = 'draft') or public.duty_approver())
  with check (public.duty_person(duty_date) or public.duty_approver());
drop policy if exists duty_log_delete on public.duty_log;
create policy duty_log_delete on public.duty_log for delete to authenticated using (public.has_admin_role(array['principal', 'tech_support']));
grant select, insert, update, delete on public.duty_log to authenticated;

-- جوالات المناوبين لتذكيرهم عبر واتساب: للوكيل والإدارة، وللمناوب عن زميله
create or replace function public.duty_mobiles(p_date date)
returns table (user_id uuid, mobile text)
language sql stable security definer set search_path = public as $$
  select t.user_id, t.mobile from duty_roster r join teachers t on t.user_id in (r.user_a, r.user_b)
   where r.duty_date = p_date and coalesce(t.mobile, '') <> '' and (public.duty_approver() or public.duty_person(p_date));
$$;
revoke execute on function public.duty_mobiles(date) from public, anon;
grant execute on function public.duty_mobiles(date) to authenticated;
-- نهاية الجزء 1
