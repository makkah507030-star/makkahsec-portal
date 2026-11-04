-- النشرات والاستبانات (1 من 2): الجداول والصلاحيات والمخزن.
-- نشرة توعوية أو استبانة يرسلها صاحب صلاحية outreach للطلاب أو أولياء الأمور أو المنسوبين، ويتابع اطلاعهم
-- وإجاباتهم. تكرار التنفيذ آمن.

create table if not exists public.outreach_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('post', 'survey')),
  title text not null check (length(trim(title)) > 0),
  body text,
  topic text,                                  -- التصنيف: توعية، تعليمات، صحة نفسية…
  media jsonb not null default '[]',           -- [{ type: image|video|file, path, name }]
  links jsonb not null default '[]',           -- [{ t, url }]، ومقاطع يوتيوب تُعرض داخل الصفحة
  questions jsonb not null default '[]',       -- [{ id, type: single|multi|scale|yesno|text|long, q, options, required }]
  needs_ack boolean not null default false,    -- «اطلعت» للنشرة
  anonymous boolean not null default false,    -- الاستبانة دون اسم: لا يُحفظ صاحب الإجابة معها
  closes_at timestamptz,
  audience jsonb not null default '{}',        -- وصف المستفيدين للعرض
  academic_year text default public.active_year(),
  sent_at timestamptz, closed_at timestamptz,
  created_by uuid not null default auth.uid(), created_by_name text, created_by_role text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists outreach_items_owner on public.outreach_items (created_by, created_at desc);

create table if not exists public.outreach_recipients (
  item_id uuid not null references public.outreach_items(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('student', 'guardian', 'staff')),
  grade int, class_no int,
  read_at timestamptz, ack_at timestamptz, answered_at timestamptz,
  remind_count int not null default 0,
  primary key (item_id, user_id)
);
create index if not exists outreach_recipients_user on public.outreach_recipients (user_id);

-- الإجابات: صاحبها فارغ في الاستبانة دون اسم، ويبقى الصف والفصل للتحليل
create table if not exists public.outreach_answers (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.outreach_items(id) on delete cascade,
  user_id uuid, kind text, grade int, class_no int,
  answers jsonb not null,                      -- { [معرّف السؤال]: قيمة أو قائمة قيم أو نص }
  created_at timestamptz not null default now()
);
create index if not exists outreach_answers_item on public.outreach_answers (item_id);

-- صاحب النشرة يديرها، والمدير والدعم الفني يطّلعون على الكل
create or replace function public.outreach_owner(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from outreach_items i where i.id = p_id
    and (i.created_by = auth.uid() or public.has_admin_role(array['principal', 'tech_support'])));
$$;
create or replace function public.outreach_recipient(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from outreach_recipients r where r.item_id = p_id and r.user_id = auth.uid());
$$;

alter table public.outreach_items enable row level security; alter table public.outreach_recipients enable row level security;
alter table public.outreach_answers enable row level security;
drop policy if exists outreach_items_read on public.outreach_items;
create policy outreach_items_read on public.outreach_items for select to authenticated
  using (created_by = auth.uid() or public.has_admin_role(array['principal', 'tech_support'])
         or (sent_at is not null and public.outreach_recipient(id)));   -- لا outreach_owner: لا يرى السطر الجديد (outreach_3.sql)
drop policy if exists outreach_items_insert on public.outreach_items;
create policy outreach_items_insert on public.outreach_items for insert to authenticated
  with check (created_by = auth.uid() and public.has_permission('outreach'));
drop policy if exists outreach_items_update on public.outreach_items;
create policy outreach_items_update on public.outreach_items for update to authenticated
  using (created_by = auth.uid() or public.has_admin_role(array['tech_support']))
  with check (created_by = auth.uid() or public.has_admin_role(array['tech_support']));
drop policy if exists outreach_items_delete on public.outreach_items;
create policy outreach_items_delete on public.outreach_items for delete to authenticated
  using (created_by = auth.uid() or public.has_admin_role(array['tech_support']));
drop policy if exists outreach_rec_read on public.outreach_recipients;
create policy outreach_rec_read on public.outreach_recipients for select to authenticated
  using (user_id = auth.uid() or public.outreach_owner(item_id));
drop policy if exists outreach_ans_read on public.outreach_answers;
create policy outreach_ans_read on public.outreach_answers for select to authenticated
  using (public.outreach_owner(item_id) or user_id = auth.uid());
grant select, insert, update, delete on public.outreach_items to authenticated; grant select on public.outreach_recipients, public.outreach_answers to authenticated;

-- الصلاحية للموجهين الطلابيين والصحي والوكلاء ورائد النشاط (والمدير والدعم الفني دائمًا)
insert into public.role_permissions (role_type, permission)
select r::admin_role_type, 'outreach' from unnest(array['counselor_1', 'counselor_2', 'counselor_3', 'health_counselor',
  'deputy_students', 'deputy_academic', 'deputy_school', 'activity_leader']) r
where exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'admin_role_type' and e.enumlabel = r)
on conflict do nothing;

-- مخزن الوسائط: صور ومقاطع وملفات حتى 50 م.ب، يقرؤها كل مستخدم داخل البوابة، ويرفع المرسل في مجلده
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('outreach', 'outreach', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "outreach read" on storage.objects;
create policy "outreach read" on storage.objects for select to authenticated using (bucket_id = 'outreach');
drop policy if exists "outreach write" on storage.objects;
create policy "outreach write" on storage.objects for insert to authenticated
  with check (bucket_id = 'outreach' and (storage.foldername(name))[1] = auth.uid()::text and public.has_permission('outreach'));
drop policy if exists "outreach delete" on storage.objects; create policy "outreach delete" on storage.objects for delete to authenticated using (bucket_id = 'outreach' and (storage.foldername(name))[1] = auth.uid()::text);
-- نهاية الجزء 1
