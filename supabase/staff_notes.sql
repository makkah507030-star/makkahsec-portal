-- مفكرتي: ملاحظات ومهام شخصية للمعلمين والإداريين (src/pages/Notebook.jsx)
-- كل ملاحظة لصاحبها وحده: لا يقرؤها غيره ولا المدير. تكرار التنفيذ آمن.
create table if not exists public.staff_notes (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text not null default '',
  body       text not null default '',
  items      jsonb not null default '[]'::jsonb,  -- قائمة مهام: [{"t": "...", "done": false}]
  due_date   date,                                 -- موعدها: تظهر في «بانتظار إجرائك» من يومها
  due_time   time,
  color      text,
  pinned     boolean not null default false,
  done_at    timestamptz,
  link_path  text,                                 -- الصفحة التي كُتبت منها
  link_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_notes_owner_idx on public.staff_notes (owner_id, done_at, due_date);

alter table public.staff_notes enable row level security;

drop policy if exists "own notes" on public.staff_notes;
create policy "own notes" on public.staff_notes
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and (select public.current_user_role()) in ('admin', 'teacher'));

-- للتحقق: يظهر سطر واحد بالقاعدة
select policyname, cmd from pg_policies where tablename = 'staff_notes';
-- نهاية الجزء 1
