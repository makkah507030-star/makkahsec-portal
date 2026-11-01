-- =====================================================================
-- بلاغات الصيانة (1): يرفعها أي معلم أو إداري بمكان العطل ونوعه وصوره،
-- وتصل المساعد الإداري 3 فيتابعها حتى إنجازها، ويُشعر صاحب البلاغ بكل تحديث.
-- ويطّلع عليها ويتابعها أيضًا وكيل الشؤون المدرسية ومدير المدرسة والدعم الفني.
-- تكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.maint_tickets (
  id bigint generated always as identity primary key,
  place_kind text not null, place text, category text not null,
  urgent boolean not null default false, description text, photos text[] not null default '{}',
  status text not null default 'new' check (status in ('new', 'in_progress', 'external', 'resolved', 'rejected')),
  reported_by uuid not null default auth.uid() references public.users(id) on delete cascade,
  reporter_name text, resolution text, handler_name text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), resolved_at timestamptz
);
create index if not exists maint_tickets_status on public.maint_tickets (status, created_at);

-- متابع البلاغات: المساعد الإداري 3، ووكيل الشؤون المدرسية، والمدير، والدعم الفني
create or replace function public.maint_handler() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['clerk_3', 'deputy_school', 'principal', 'tech_support']);
$$;
create or replace function public.maint_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from users where id = auth.uid() and is_active and role::text in ('teacher', 'admin'));
$$;
-- مستلمو إشعار البلاغ الجديد: المساعد الإداري 3
create or replace function public.maint_recipient_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select ar.user_id from admin_roles ar join users u on u.id = ar.user_id
   where ar.role_type::text = 'clerk_3' and u.is_active and public.maint_staff();
$$;
revoke all on function public.maint_handler(), public.maint_staff(), public.maint_recipient_ids() from public, anon;
grant execute on function public.maint_handler(), public.maint_staff(), public.maint_recipient_ids() to authenticated;

alter table public.maint_tickets enable row level security;
drop policy if exists maint_read on public.maint_tickets;
create policy maint_read on public.maint_tickets for select to authenticated using (reported_by = auth.uid() or public.maint_handler());
drop policy if exists maint_add on public.maint_tickets;
create policy maint_add on public.maint_tickets for insert to authenticated with check (reported_by = auth.uid() and public.maint_staff());
drop policy if exists maint_edit on public.maint_tickets;
create policy maint_edit on public.maint_tickets for update to authenticated using (public.maint_handler()) with check (public.maint_handler());
drop policy if exists maint_del on public.maint_tickets;
create policy maint_del on public.maint_tickets for delete to authenticated
  using (public.has_admin_role(array['principal', 'tech_support']) or (reported_by = auth.uid() and status = 'new'));
grant select, insert, update, delete on public.maint_tickets to authenticated;

-- صور البلاغات: مستودع خاص (10 ميجا للملف)، يرفع إليه الموظفون، ويقرؤه صاحب البلاغ والمتابعون
insert into storage.buckets (id, name, public, file_size_limit) values ('maintenance', 'maintenance', false, 10485760)
on conflict (id) do nothing;
drop policy if exists maint_files_add on storage.objects;
create policy maint_files_add on storage.objects for insert to authenticated
  with check (bucket_id = 'maintenance' and public.maint_staff());
drop policy if exists maint_files_read on storage.objects;
create policy maint_files_read on storage.objects for select to authenticated
  using (bucket_id = 'maintenance' and public.maint_staff());
drop policy if exists maint_files_del on storage.objects;
create policy maint_files_del on storage.objects for delete to authenticated
  using (bucket_id = 'maintenance' and (public.maint_handler() or owner = auth.uid()));

-- نهاية الجزء 1
