-- =====================================================================
-- سجل العمليات الحساسة — من نفّذ كل إجراء مؤكَّد في مناطق الخطر، ومتى.
--
-- • يُسجَّل صفّ عند كل تأكيد في نافذة confirmDanger (الاستيراد، النشر، الإرسال،
--   الصلاحيات، التوقيت، الاعتماد...)، بعنوان الإجراء وأثره والصفحة.
-- • اسم الحساب وأدواره يملؤها الخادم من auth.uid()، فلا يمكن انتحالها من المتصفح.
-- • القراءة للدعم الفني وحده، والسجل لا يُعدَّل ولا يُحذف من البوابة.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  user_roles text[] not null default '{}',
  action text not null,
  details jsonb not null default '[]'::jsonb,
  level text not null default 'medium',
  path text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_user_idx on public.audit_log (user_id, created_at desc);

-- هوية المنفّذ من الخادم لا من المتصفح
create or replace function public.audit_log_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.created_at := now();
  select u.full_name into new.user_name from public.users u where u.id = auth.uid();
  select coalesce(array_agg(r.role_type::text order by r.role_type::text), '{}')
    into new.user_roles from public.admin_roles r where r.user_id = auth.uid();
  if coalesce(array_length(new.user_roles, 1), 0) = 0 then
    select array[u.role::text] into new.user_roles from public.users u where u.id = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists audit_log_stamp on public.audit_log;
create trigger audit_log_stamp before insert on public.audit_log
  for each row execute function public.audit_log_stamp();

alter table public.audit_log enable row level security;

drop policy if exists audit_log_insert_own on public.audit_log;
create policy audit_log_insert_own on public.audit_log as PERMISSIVE for INSERT to authenticated
  with check (auth.uid() is not null);

drop policy if exists audit_log_read_tech on public.audit_log;
create policy audit_log_read_tech on public.audit_log as PERMISSIVE for SELECT to authenticated
  using (public.is_tech_support());
