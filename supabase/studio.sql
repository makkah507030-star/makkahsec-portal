-- =====================================================================
-- استوديو البوابة: «تصاميمي» — يحفظ المستخدم تصاميمه ليعدّلها أو يعيد طباعتها.
-- كل مستخدم يرى تصاميمه فقط ويعدّلها ويحذفها.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- =====================================================================

create table if not exists public.studio_designs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  template    text not null,
  section     text,
  theme       text not null default 'light',
  orient      text not null default 'portrait',
  title       text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists studio_designs_user_idx on public.studio_designs (user_id, updated_at desc);

alter table public.studio_designs enable row level security;

drop policy if exists studio_designs_own on public.studio_designs;
create policy studio_designs_own on public.studio_designs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.studio_designs to authenticated;
