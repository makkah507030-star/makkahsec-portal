-- =====================================================================
-- مركز التدريب — القدرات (الدفعة الأولى): سجل إجابات الطالب، وأسئلة المعلمين
-- الأسئلة الرسمية (الاختبارات التجريبية لهيئة تقويم التعليم والتدريب) في الكود
-- src/qudrat-content، ومفتاح السؤال فيها مثل GATSFT-12. وأسئلة المعلمين هنا ومفتاحها t:<id>.
-- مفتوح لكل الصفوف ولكل حساب. تكرار التنفيذ آمن.
-- =====================================================================

-- كل محاولة إجابة: لحساب المستوى في كل مهارة والخطة لاحقًا
create table if not exists public.qudrat_answers (
  id         bigserial primary key,
  user_id    uuid not null default auth.uid(),
  qkey       text not null,                   -- GATSFT-12 أو t:<uuid>
  sec        text not null check (sec in ('quant', 'verbal')),
  skill      text not null,
  correct    boolean not null,
  hinted     boolean not null default false,  -- فتح التلميح قبل الإجابة
  ms         int,                             -- زمن الإجابة بالملّي ثانية
  mode       text not null default 'practice',
  created_at timestamptz not null default now()
);
create index if not exists qudrat_answers_user on public.qudrat_answers (user_id, created_at desc);

-- أسئلة يضيفها المعلمون بالصيغة نفسها
create table if not exists public.qudrat_questions (
  id         uuid primary key default gen_random_uuid(),
  sec        text not null check (sec in ('quant', 'verbal')),
  skill      text not null,
  q          text not null,
  o          text[] not null check (array_length(o, 1) = 4),
  a          smallint not null check (a between 0 and 3),
  hint       text,
  method     text,
  cmp        text[],                          -- قيمتا المقارنة إن كان سؤال مقارنة
  passage    text,                            -- نص قطعة أو معطيات مشتركة
  published  boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.qudrat_answers enable row level security;
alter table public.qudrat_questions enable row level security;

-- الإجابات: كل حساب يكتب ويقرأ إجاباته، والإدارة تقرأ للمتابعة
drop policy if exists "qudrat answers own" on public.qudrat_answers;
create policy "qudrat answers own" on public.qudrat_answers for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "qudrat answers add" on public.qudrat_answers;
create policy "qudrat answers add" on public.qudrat_answers for insert to authenticated
  with check (user_id = (select auth.uid()));

-- الأسئلة: المنشور للجميع، والمعلم يضيف ويعدّل أسئلته، والدعم الفني والمدير يديران الكل
create or replace function public.qudrat_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['principal', 'deputy_academic', 'tech_support']);
$$;

drop policy if exists "qudrat q read" on public.qudrat_questions;
create policy "qudrat q read" on public.qudrat_questions for select to authenticated
  using (published or created_by = (select auth.uid()) or (select public.qudrat_manager()));
drop policy if exists "qudrat q add" on public.qudrat_questions;
create policy "qudrat q add" on public.qudrat_questions for insert to authenticated
  with check ((select public.is_school_staff()) and created_by = (select auth.uid()));
drop policy if exists "qudrat q edit" on public.qudrat_questions;
create policy "qudrat q edit" on public.qudrat_questions for update to authenticated
  using (created_by = (select auth.uid()) or (select public.qudrat_manager()))
  with check (created_by = (select auth.uid()) or (select public.qudrat_manager()));
drop policy if exists "qudrat q del" on public.qudrat_questions;
create policy "qudrat q del" on public.qudrat_questions for delete to authenticated
  using (created_by = (select auth.uid()) or (select public.qudrat_manager()));

-- ملخص الحساب: عدد المحاولات والصحيح في كل مهارة (للصفحة الرئيسية للمركز)
create or replace function public.qudrat_my_skills()
returns table (sec text, skill text, total int, correct int, last_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select sec, skill, count(*)::int, count(*) filter (where correct)::int, max(created_at)
  from public.qudrat_answers where user_id = auth.uid()
  group by sec, skill;
$$;

-- نهاية الجزء 1
