-- =====================================================================
-- الترشيحات (الجزء 1 من 4): الجداول والصلاحيات. إعلانات التقديم للطلاب (اللجنة الإعلامية،
-- الفريق الكشفي، الإذاعة…) وطلباتهم. ينشئ الإعلان كل إداري ومن له دور إداري من المعلمين،
-- ويدير كلٌّ إعلاناته، والمدير والدعم الفني يرون الكل. الطالب يقدّم ويتابع عبر الدوال (الجزء 2).
-- تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.nom_calls (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  unit text,                                   -- الجهة: اللجنة الإعلامية، الفريق الكشفي…
  body text,                                   -- وصف الدور
  tasks text,                                  -- المهام والمطلوب
  special_terms text,                          -- شروط خاصة يقرّ بها الطالب
  grades int[] not null default '{1,2,3}',
  seats int not null default 10 check (seats > 0),
  reserve int not null default 0 check (reserve >= 0),
  opens_on date not null default current_date,
  closes_on date not null,
  rules jsonb not null default '{}',           -- {min_attend, max_degree, min_avg}
  questions jsonb not null default '[]',       -- [{id, q, kind: text|choice, options}]
  criteria jsonb not null default '[]',        -- معايير المقابلة [{id, name, max}]
  interview_place text,
  slot_minutes int not null default 10,
  guardian_ok boolean not null default false,  -- يشترط موافقة ولي الأمر
  link_scouts boolean not null default false,  -- المقبولون يُضافون للفريق الكشفي
  published boolean not null default false,
  results_at timestamptz,
  cancelled_at timestamptz,
  owner_id uuid not null default auth.uid() references public.users(id),
  owner_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.nom_applications (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.nom_calls(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  answers jsonb not null default '{}',
  eligibility jsonb,                           -- لقطة الشروط وقت التقديم
  stage text not null default 'applied'
    check (stage in ('applied', 'shortlisted', 'accepted', 'reserve', 'rejected', 'withdrawn')),
  guardian_ok_at timestamptz,
  interview_at timestamptz,
  interview_place text,
  scores jsonb not null default '{}',
  interview_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (call_id, student_id)
);
create index if not exists nom_applications_student on public.nom_applications (student_id);

-- من يدير الإعلانات: كل من له دور إداري (ومنهم المعلم ذو الدورين)
create or replace function public.nom_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_roles r join users u on u.id = r.user_id
                  where r.user_id = auth.uid() and u.is_active);
$$;
-- صاحب الإعلان، أو المدير والدعم الفني
create or replace function public.nom_owns(p_call uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['principal', 'tech_support'])
      or exists (select 1 from nom_calls c where c.id = p_call and c.owner_id = auth.uid() and public.nom_manager());
$$;

alter table public.nom_calls enable row level security;
alter table public.nom_applications enable row level security;

drop policy if exists nom_calls_read on public.nom_calls;
create policy nom_calls_read on public.nom_calls for select to authenticated using (public.nom_owns(id));
drop policy if exists nom_calls_insert on public.nom_calls;
create policy nom_calls_insert on public.nom_calls for insert to authenticated
  with check (public.nom_manager() and owner_id = auth.uid());
drop policy if exists nom_calls_update on public.nom_calls;
create policy nom_calls_update on public.nom_calls for update to authenticated
  using (public.nom_owns(id)) with check (public.nom_owns(id));
drop policy if exists nom_calls_delete on public.nom_calls;
create policy nom_calls_delete on public.nom_calls for delete to authenticated using (public.nom_owns(id));

-- الطلبات: يقرؤها صاحب الإعلان؛ والكتابة كلها عبر الدوال
drop policy if exists nom_apps_read on public.nom_applications;
create policy nom_apps_read on public.nom_applications for select to authenticated using (public.nom_owns(call_id));

grant select, insert, update, delete on public.nom_calls to authenticated;
grant select on public.nom_applications to authenticated;
revoke all on function public.nom_manager(), public.nom_owns(uuid) from public, anon;
grant execute on function public.nom_manager(), public.nom_owns(uuid) to authenticated;
-- نهاية الجزء 1
