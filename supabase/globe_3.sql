-- =====================================================================
-- برنامج جلوب (الجزء 3) — بعد الجزأين 1 و2:
-- • globe_members.role: صفة الطالب في الفريق (نائب المشرف العام، مشرف رصد، عضو)؛
--   والمشرف العام هو مشرف البرنامج (المعلم) فلا يُسند لطالب.
-- • globe_library: المكتبة: المرئيات (رابط يوتيوب من قناة البرنامج) والتقارير والمنشورات (صورة أو PDF).
-- • globe_badges: أوسمة البرنامج بالعام والربع، بعددها ومجالاتها (لوحة شرف GLOBE).
-- • globe_supervisor: السيرة الذاتية لمشرف البرنامج وشهادة اعتماد تدريبه (صف واحد).
-- • إلغاء التواصل مع ولي الأمر: حذف الدالة globe_roster (جوالات أولياء الأمور).
-- الملفات في مخزن globe-files: library/… و supervisor/…؛ الكتابة لصلاحية «برنامج جلوب».
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
alter table public.globe_members add column if not exists role text not null default 'member';
alter table public.globe_members drop constraint if exists globe_members_role_check;
alter table public.globe_members add constraint globe_members_role_check
  check (role in ('deputy', 'monitor', 'member'));

create table if not exists public.globe_library (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('video', 'doc')),
  title text not null check (length(trim(title)) > 0),
  url text,                  -- رابط يوتيوب للمرئيات
  path text,                 -- ملف التقرير أو المنشور في globe-files
  mime text,
  item_date date,
  note text,
  created_by uuid default auth.uid(), created_by_name text,
  created_at timestamptz not null default now(),
  check ((kind = 'video' and url is not null) or (kind = 'doc' and path is not null))
);

create table if not exists public.globe_badges (
  id uuid primary key default gen_random_uuid(),
  year int not null check (year between 2000 and 2100),
  quarter int not null check (quarter between 1 and 4),
  badges int not null default 0 check (badges >= 0),
  domains text[] not null default '{}',
  note text,
  updated_at timestamptz not null default now(),
  unique (year, quarter)
);

create table if not exists public.globe_supervisor (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}',
  cert_path text,
  cert_mime text,
  updated_at timestamptz not null default now()
);

alter table public.globe_library enable row level security;
alter table public.globe_badges enable row level security;
alter table public.globe_supervisor enable row level security;

do $$ declare t text; begin
  foreach t in array array['globe_library', 'globe_badges', 'globe_supervisor'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.has_permission(''globe'') or public.is_admin())', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.has_permission(''globe'')) with check (public.has_permission(''globe''))', t || '_write', t);
  end loop;
end $$;

-- لا تواصل مع أولياء الأمور من البرنامج
drop function if exists public.globe_roster();

-- للتحقق
select (select count(*) from public.globe_members) as "طلاب البرنامج",
       (select count(*) from public.globe_library) as "المكتبة",
       (select count(*) from public.globe_badges) as "أرباع الأوسمة",
       to_regprocedure('public.globe_roster()') is null as "أُلغي جوال ولي الأمر";
-- نهاية الجزء 3
