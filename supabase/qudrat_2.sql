-- =====================================================================
-- مركز التدريب — القدرات (الدفعة الثانية): خطة الطالب، والاختبار المحاكي، والمقارنة
-- يلزم قبله qudrat_1.sql. تكرار التنفيذ آمن.
-- =====================================================================

-- خطة الحساب: موعد الاختبار (أو تقديره) ووقت التدريب اليومي
create table if not exists public.qudrat_plans (
  user_id       uuid primary key default auth.uid(),
  exam_date     date not null,
  approx        boolean not null default false,  -- الموعد تقديري
  daily_minutes int not null default 30 check (daily_minutes between 10 and 180),
  target        int check (target between 50 and 100),   -- الدرجة المستهدفة
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- الاختبارات المحاكية الكاملة (أربعة أقسام بوقتها)
create table if not exists public.qudrat_mocks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  set_code    text not null,                  -- GATSFT أو GATAFT
  total       int not null,
  correct     int not null,
  quant_pct   int,
  verbal_pct  int,
  by_skill    jsonb not null default '{}',    -- { "arith": [صحيح, الكل], … }
  answers     jsonb not null default '{}',    -- { "12": 2, … } رقم السؤال ← الخيار
  duration_s  int,
  created_at  timestamptz not null default now()
);
create index if not exists qudrat_mocks_user on public.qudrat_mocks (user_id, created_at desc);

alter table public.qudrat_plans enable row level security;
alter table public.qudrat_mocks enable row level security;

drop policy if exists "qudrat plan own" on public.qudrat_plans;
create policy "qudrat plan own" on public.qudrat_plans for all to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()));
drop policy if exists "qudrat mocks read" on public.qudrat_mocks;
create policy "qudrat mocks read" on public.qudrat_mocks for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "qudrat mocks add" on public.qudrat_mocks;
create policy "qudrat mocks add" on public.qudrat_mocks for insert to authenticated
  with check (user_id = (select auth.uid()));

-- المقارنة: متوسط المتدربين في كل مهارة (أرقام مجمّعة بلا أسماء)، وترتيب الحساب بينهم
-- يُحتسب من أجاب عن 20 سؤالًا فأكثر
create or replace function public.qudrat_compare()
returns table (skill text, avg_pct int, my_pct int, users int, my_rank int, ranked int)
language sql stable security definer set search_path = public as $$
  with per as (
    select user_id, skill, avg(correct::int) * 100 as pct
    from qudrat_answers group by user_id, skill
  ), act as (
    select user_id, avg(correct::int) * 100 as pct
    from qudrat_answers group by user_id having count(*) >= 20
  ), me as (
    select (select count(*) from act a2 where a2.pct > a.pct) + 1 as r from act a where a.user_id = auth.uid()
  )
  select p.skill, round(avg(p.pct))::int,
         round(max(p.pct) filter (where p.user_id = auth.uid()))::int,
         count(*)::int,
         (select r from me)::int, (select count(*) from act)::int
  from per p group by p.skill;
$$;
revoke all on function public.qudrat_compare() from public, anon;
grant execute on function public.qudrat_compare() to authenticated;

-- نهاية الجزء 1
