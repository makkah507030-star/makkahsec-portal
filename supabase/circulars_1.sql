-- =====================================================================
-- التعاميم (الجزء 1 من 2): الجداول والصلاحيات والمخزن. تعميم وارد (من الإدارة العامة للتعليم
-- أو الوزارة) أو داخلي من المدرسة، يُرسل للمنسوبين وأولياء الأمور، ويُتابع اطلاع كل مستفيد.
-- يديرها من له صلاحية «التعاميم» (role_permissions: circulars) مع المدير والدعم الفني.
-- تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.circulars (
  id uuid primary key default gen_random_uuid(),
  seq int,                                     -- رقم القيد في السنة (يُسند تلقائيًا)
  academic_year text,
  direction text not null default 'incoming' check (direction in ('incoming', 'internal')),
  ref_no text, ref_date text,                  -- رقم التعميم وتاريخه كما في الأصل
  source text,                                 -- الجهة المصدرة
  subject text not null,
  body text,                                   -- ملخص أو نص التعميم
  category text,
  priority text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  action_required text,                        -- المطلوب من المستفيد إن وُجد
  due_date date,
  needs_ack boolean not null default true,
  file_path text, file_name text,
  audience jsonb not null default '{}',        -- وصف المستفيدين للعرض في الأرشيف
  sent_at timestamptz,
  closed_at timestamptz,                       -- انتهت متابعته (لا تذكير بعده)
  created_by uuid default auth.uid(),
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists circulars_year on public.circulars (academic_year, seq);

create table if not exists public.circular_recipients (
  circular_id uuid not null references public.circulars(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null default 'staff' check (kind in ('staff', 'guardian')),
  name text,
  read_at timestamptz,
  ack_at timestamptz,
  reminded_at timestamptz,
  remind_count int not null default 0,
  primary key (circular_id, user_id)
);
create index if not exists circular_recipients_user on public.circular_recipients (user_id);

-- مدير التعاميم: صاحب صلاحية «التعاميم» (has_permission يشمل المدير والدعم الفني)
create or replace function public.circ_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_permission('circulars');
$$;
create or replace function public.circ_recipient(p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from circular_recipients r where r.circular_id::text = p_id and r.user_id = auth.uid());
$$;

-- رقم القيد: التالي في السنة الدراسية
create or replace function public.circulars_seq() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.seq is null then
    select coalesce(max(seq), 0) + 1 into new.seq from circulars where academic_year is not distinct from new.academic_year;
  end if;
  new.created_by_name := coalesce(new.created_by_name, (select full_name from users where id = auth.uid()));
  return new;
end $$;
drop trigger if exists circulars_seq on public.circulars;
create trigger circulars_seq before insert on public.circulars for each row execute function public.circulars_seq();

alter table public.circulars enable row level security;
alter table public.circular_recipients enable row level security;
drop policy if exists circulars_manage on public.circulars;
create policy circulars_manage on public.circulars for all to authenticated
  using (public.circ_manager()) with check (public.circ_manager());
drop policy if exists circulars_read_own on public.circulars;
create policy circulars_read_own on public.circulars for select to authenticated
  using (sent_at is not null and public.circ_recipient(id::text));
drop policy if exists circ_rec_manage on public.circular_recipients;
create policy circ_rec_manage on public.circular_recipients for select to authenticated using (public.circ_manager());
drop policy if exists circ_rec_own on public.circular_recipients;
create policy circ_rec_own on public.circular_recipients for select to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.circulars to authenticated;
grant select on public.circular_recipients to authenticated;
revoke all on function public.circ_manager(), public.circ_recipient(text) from public, anon;
grant execute on function public.circ_manager(), public.circ_recipient(text) to authenticated;

-- ملفات التعاميم: مخزن خاص، مجلد باسم التعميم؛ يرفعها المدير ويقرؤها هو ومستفيدو التعميم
insert into storage.buckets (id, name, public, file_size_limit)
values ('circulars', 'circulars', false, 15728640) on conflict (id) do nothing;
drop policy if exists "circulars files read" on storage.objects;
create policy "circulars files read" on storage.objects for select to authenticated
  using (bucket_id = 'circulars' and (public.circ_manager() or public.circ_recipient((storage.foldername(name))[1])));
drop policy if exists "circulars files write" on storage.objects;
create policy "circulars files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'circulars' and public.circ_manager());
drop policy if exists "circulars files delete" on storage.objects;
create policy "circulars files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'circulars' and public.circ_manager());
-- نهاية الجزء 1
