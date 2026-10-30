-- =====================================================================
-- التصويت والاستطلاعات (الجزء 1 من 2): الجداول والصلاحيات.
-- • polls: استطلاع (خيار واحد أو عدة خيارات) أو انتخاب (اقتراع سري)، لمن يظهر (الطلاب،
--   أولياء الأمور، المعلمون والإداريون) وفي أي صفوف، وموعدا الفتح والإغلاق، ومتى تظهر النتائج.
-- • poll_options: الخيارات أو المرشحون؛ وفي انتخاب الترشيحات يرتبط المرشح بطلبه (app_id).
-- • poll_voters: من صوّت (لمنع التكرار ولنسبة المشاركة) بلا اختياره.
-- • poll_ballots: الأصوات بلا هوية المصوّت، فلا يُعرف لمن صوّت أحد، ولا يقرؤها أحد مباشرة.
-- • صلاحية «التصويت والاستطلاعات» (polls) لدور «برنامج صوت الطالب» هنا، والمدير والدعم الفني دائمًا.
-- يُنفَّذ بعد home_banners.sql في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'poll' check (kind in ('poll', 'election')),
  title text not null check (length(trim(title)) > 0),
  body text,
  max_choices int not null default 1 check (max_choices >= 1),
  audience text[] not null default '{student}',
  grades int[] not null default '{}',                     -- فارغ = كل الصفوف
  opens_at timestamptz not null default now(),
  closes_at timestamptz not null,
  results text not null default 'after' check (results in ('live', 'after', 'owner')),
  published boolean not null default false,
  nom_call_id uuid,                                       -- انتخاب من إعلان ترشيح (polls_2.sql)
  approved_at timestamptz,                                -- اعتماد اللجنة للنتيجة
  cancelled_at timestamptz,
  created_by uuid not null default auth.uid(), created_by_name text,
  created_at timestamptz not null default now(),
  check (closes_at > opens_at)
);
create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  note text,
  app_id uuid,                                            -- طلب المرشح في الترشيحات
  sort int not null default 0
);
create table if not exists public.poll_voters (
  poll_id uuid not null references public.polls(id) on delete cascade,
  voter uuid not null, at timestamptz not null default now(),
  primary key (poll_id, voter)
);
create table if not exists public.poll_ballots (
  id bigserial primary key,
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade
);
create index if not exists poll_ballots_poll on public.poll_ballots (poll_id, option_id);

-- من يدير الاستطلاع: صاحب الصلاحية، أو صاحب إعلان الترشيح المرتبط به
create or replace function public.poll_manager(p_poll uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_permission('polls') or exists (
    select 1 from polls p where p.id = p_poll and p.nom_call_id is not null and public.nom_owns(p.nom_call_id));
$$;

-- هل في الاستطلاع أصوات (لقفل خياراته وحذفه) — دالة لأن سجل المصوّتين لا يقرؤه غير صاحبه
create or replace function public.poll_has_votes(p_poll uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from poll_voters where poll_id = p_poll);
$$;

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_voters enable row level security;
alter table public.poll_ballots enable row level security;
drop policy if exists polls_read on public.polls;
create policy polls_read on public.polls for select to authenticated
  using (public.poll_manager(id) or (published and cancelled_at is null and opens_at <= now()
         and public.banner_for_me(audience, grades)));
drop policy if exists polls_add on public.polls;
create policy polls_add on public.polls for insert to authenticated
  with check (created_by = auth.uid() and (public.has_permission('polls')
              or (nom_call_id is not null and public.nom_owns(nom_call_id))));
drop policy if exists polls_edit on public.polls;
create policy polls_edit on public.polls for update to authenticated
  using (public.poll_manager(id)) with check (public.poll_manager(id));
drop policy if exists polls_del on public.polls;
create policy polls_del on public.polls for delete to authenticated
  using (public.poll_manager(id) and not public.poll_has_votes(id));
drop policy if exists poll_options_read on public.poll_options;
create policy poll_options_read on public.poll_options for select to authenticated
  using (exists (select 1 from polls p where p.id = poll_id));          -- يتبع قراءة الاستطلاع
drop policy if exists poll_options_write on public.poll_options;
create policy poll_options_write on public.poll_options for all to authenticated
  using (public.poll_manager(poll_id) and not public.poll_has_votes(poll_id))
  with check (public.poll_manager(poll_id) and not public.poll_has_votes(poll_id));
drop policy if exists poll_voters_mine on public.poll_voters;
create policy poll_voters_mine on public.poll_voters for select to authenticated using (voter = auth.uid());
-- poll_ballots بلا سياسة قراءة: لا يقرؤها أحد مباشرة، والنتائج من poll_results وحدها

insert into public.role_permissions (role_type, permission)
values ('student_voice', 'polls') on conflict do nothing;

select to_regclass('public.polls') is not null as "الجداول جاهزة",
       exists (select 1 from public.role_permissions where role_type = 'student_voice' and permission = 'polls') as "الصلاحية مسندة";
-- نهاية الجزء 1
