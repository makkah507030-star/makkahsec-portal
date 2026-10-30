-- =====================================================================
-- قسم التقويم والاعتماد المدرسي (2): خطة التحسين المبنية على المؤشرات، بنسخ.
-- النسخة الأولى من تقرير التقويم الذاتي، وبعد التقويم الخارجي تُنسخ نسخة جديدة تُعدَّل
-- وتُعتمد فتصبح السارية، وتبقى السابقة مؤرشفة للرجوع إليها. لكل مؤشر في الخطة برنامج،
-- ولمؤشرات التقدم والتميز إجراء استدامة. يُنفَّذ بعد acc_1.sql. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.acc_plans (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  version int not null default 1,
  title text not null,
  source text not null default 'self' check (source in ('self', 'external')),
  report_id uuid references public.acc_reports(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  milestones jsonb not null default '[]',        -- محطات المتابعة [{ title, due, owner, done_at }]
  approved_at timestamptz, approved_by_name text,
  created_by_name text, created_at timestamptz not null default now()
);
create table if not exists public.acc_programs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.acc_plans(id) on delete cascade,
  kind text not null default 'plan' check (kind in ('plan', 'sustain')),
  code text not null check (code ~ '^[1-4]-[0-9]-[0-9]-[0-9]$'),
  domain int generated always as (substr(code, 1, 1)::int) stored,
  current numeric, target numeric,
  semester text, team text[] not null default '{}',
  initiative text,                               -- اسم البرنامج أو إجراء الاستدامة
  methods jsonb not null default '[]',           -- [{ t, done: bool, level: high|mid|low, met: bool }]
  evidence text[] not null default '{}',
  follow text, period text, measure text, needs text, rec text,
  owner text,                                    -- المسؤول في جدول الاستدامة
  sort int not null default 0,
  updated_by_name text, updated_at timestamptz not null default now(),
  unique (plan_id, code)
);
create index if not exists acc_programs_plan on public.acc_programs (plan_id, domain);

alter table public.acc_plans enable row level security;
alter table public.acc_programs enable row level security;
drop policy if exists acc_plans_read on public.acc_plans;
create policy acc_plans_read on public.acc_plans for select to authenticated using (public.acc_member());
drop policy if exists acc_plans_write on public.acc_plans;
create policy acc_plans_write on public.acc_plans for all to authenticated using (public.acc_coord()) with check (public.acc_coord());
-- العضو يرى برامج مجالاته ويعمل عليها ما لم تُؤرشف النسخة، والإضافة والحذف للمشرف
drop policy if exists acc_programs_read on public.acc_programs;
create policy acc_programs_read on public.acc_programs for select to authenticated using (public.acc_domain(domain));
drop policy if exists acc_programs_add on public.acc_programs;
create policy acc_programs_add on public.acc_programs for insert to authenticated with check (public.acc_coord());
drop policy if exists acc_programs_del on public.acc_programs;
create policy acc_programs_del on public.acc_programs for delete to authenticated using (public.acc_coord());
drop policy if exists acc_programs_edit on public.acc_programs;
create policy acc_programs_edit on public.acc_programs for update to authenticated
  using (public.acc_domain(domain) and exists (select 1 from acc_plans p where p.id = plan_id and p.status <> 'archived'))
  with check (public.acc_domain(domain));
grant select, insert, update, delete on public.acc_plans, public.acc_programs to authenticated;

-- نسخة جديدة من خطة (بعد التقويم الخارجي مثلًا): تُنسخ البرامج، ويُحدَّث «الحالي» من نسب التقرير
create or replace function public.acc_plan_copy(p_plan uuid, p_report uuid, p_title text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_new uuid; v_sc jsonb := '{}'; v_src text := 'self';
begin
  if not public.acc_coord() then raise exception 'لمشرف اللجنة ومدير المدرسة'; end if;
  if p_report is not null then
    select scores, case kind when 'external' then 'external' else 'self' end into v_sc, v_src from acc_reports where id = p_report;
  end if;
  insert into acc_plans (academic_year, version, title, source, report_id, milestones, created_by_name)
  select p.academic_year, (select max(version) + 1 from acc_plans x where x.academic_year = p.academic_year),
         p_title, v_src, p_report, p.milestones, (select full_name from users where id = auth.uid())
  from acc_plans p where p.id = p_plan returning id into v_new;
  if v_new is null then raise exception 'الخطة غير موجودة'; end if;
  insert into acc_programs (plan_id, kind, code, current, target, semester, team, initiative, methods, evidence,
                            follow, period, measure, needs, rec, owner, sort)
  select v_new, kind, code, coalesce((v_sc ->> code)::numeric, current), target, semester, team, initiative,
         (select coalesce(jsonb_agg(jsonb_build_object('t', m ->> 't')), '[]') from jsonb_array_elements(methods) m),
         evidence, follow, period, measure, needs, rec, owner, sort
  from acc_programs where plan_id = p_plan;
  return v_new;
end $$;
-- اعتماد نسخة: تصبح السارية وتُؤرشف غيرها من العام نفسه
create or replace function public.acc_plan_activate(p_plan uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.acc_coord() then raise exception 'لمشرف اللجنة ومدير المدرسة'; end if;
  update acc_plans set status = 'archived' where academic_year = (select academic_year from acc_plans where id = p_plan)
    and id <> p_plan and status = 'active';
  update acc_plans set status = 'active', approved_at = now(), approved_by_name = (select full_name from users where id = auth.uid())
    where id = p_plan;
end $$;
revoke all on function public.acc_plan_copy(uuid, uuid, text), public.acc_plan_activate(uuid) from public, anon;
grant execute on function public.acc_plan_copy(uuid, uuid, text), public.acc_plan_activate(uuid) to authenticated;

-- نهاية الجزء 2
