-- =====================================================================
-- نماذج التطوير المهني — منع الشواهد الصورية (1 من 2): الموافقة قبل التنفيذ، وإلغاء الاعتماد.
-- • ورشة العمل والدرس التطبيقي ودورة بحث الدرس: خطة تُرفع قبل التنفيذ ويوافق عليها وكيل الشؤون
--   التعليمية أو المدير (كما في الدليل)، ولا يُقبل تقريرها إلا لخطة موافق عليها قبل تاريخ التنفيذ.
-- • حالة «أُلغي اعتماده» لما ثبت أنه صوري. وأعمدة الموافقة لا يغيّرها صاحب النموذج بنفسه.
-- يُنفَّذ بعد pd_guide_kinds.sql. تكرار التنفيذ آمن.
-- =====================================================================
alter table public.pd_reports drop constraint if exists pd_reports_status_check;
alter table public.pd_reports add constraint pd_reports_status_check
  check (status in ('draft', 'signing', 'pending', 'approved', 'returned', 'revoked'));
alter table public.pd_reports add column if not exists plan_submitted_at timestamptz;
alter table public.pd_reports add column if not exists plan_approved_at timestamptz;
alter table public.pd_reports add column if not exists plan_approved_name text;
alter table public.pd_reports add column if not exists plan_note text;

-- أعمدة الموافقة وحالة الاعتماد لا تتغير إلا من دوال الاعتماد (أو الدعم الفني)
create or replace function public.pd_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('pd.allow', true), '') = '1' or public.has_admin_role(array['tech_support']) then return new; end if;
  new.plan_submitted_at := old.plan_submitted_at; new.plan_approved_at := old.plan_approved_at;
  new.plan_approved_name := old.plan_approved_name; new.plan_note := old.plan_note;
  if new.status in ('pending', 'approved', 'revoked') and new.status is distinct from old.status then new.status := old.status; end if;
  return new;
end $$;
drop trigger if exists pd_guard on public.pd_reports;
create trigger pd_guard before update on public.pd_reports for each row execute function public.pd_guard();

-- صاحب النموذج يرفع خطته قبل التنفيذ
create or replace function public.pd_plan_submit(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r pd_reports;
begin
  select * into r from pd_reports where id = p_id;
  if r.owner_user_id is distinct from auth.uid() or r.status not in ('draft', 'returned') then raise exception 'غير مصرّح'; end if;
  if r.kind not in ('workshop', 'applied', 'lesson_study') then raise exception 'هذا النشاط لا يحتاج موافقة قبل التنفيذ'; end if;
  if coalesce(trim(r.data->>'title'), '') = '' or coalesce(r.data->>'date', '') = '' or coalesce(trim(r.data->>'plan'), '') = '' then
    raise exception 'أكمل العنوان وتاريخ التنفيذ والخطة';
  end if;
  if (r.data->>'date')::date < current_date then raise exception 'تاريخ التنفيذ مضى: الخطة تُرفع قبل التنفيذ'; end if;
  perform set_config('pd.allow', '1', true);
  update pd_reports set plan_submitted_at = now(), plan_note = null, updated_at = now() where id = p_id;
end $$;

-- الموافقة على الخطة أو إعادتها بملاحظة (وكيل الشؤون التعليمية والمدير والدعم الفني)
create or replace function public.pd_plan_decide(p_id uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_admin_role(array['deputy_academic', 'principal', 'tech_support']) then raise exception 'غير مصرّح'; end if;
  if not p_approve and coalesce(trim(p_note), '') = '' then raise exception 'اكتب ملاحظة الإعادة'; end if;
  perform set_config('pd.allow', '1', true);
  update pd_reports set
    plan_approved_at = case when p_approve then now() end,
    plan_approved_name = case when p_approve then (select full_name from users where id = auth.uid()) end,
    plan_submitted_at = case when p_approve then plan_submitted_at end,
    plan_note = nullif(trim(p_note), ''), updated_at = now()
   where id = p_id and plan_submitted_at is not null and plan_approved_at is null;
  if not found then raise exception 'لا خطة بانتظار الموافقة'; end if;
end $$;

revoke execute on function public.pd_plan_submit(uuid), public.pd_plan_decide(uuid, boolean, text) from public, anon;
grant execute on function public.pd_plan_submit(uuid), public.pd_plan_decide(uuid, boolean, text) to authenticated;
-- نهاية الجزء 1
