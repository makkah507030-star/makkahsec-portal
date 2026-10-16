-- حلقة التحسين — المرحلة الثانية (الجزء 1 من 3): اختبار التحقق في دورة الاختبار.
-- • بعد تنفيذ الخطة العلاجية يُنشأ «اختبار تحقق» (period = 'verify') لطلابها، مرتبطًا بها (verify_plan_id).
-- • quiz_plans: round (الخطة الأولى أو الثانية بدعم أعلى)، وverify_quiz_id، والأثر المقيس impact وmeasured_at.
-- • الأثر يكتبه quiz_plan_measure وحدها (الجزء 2)، فلا يُعدَّل يدويًا.
-- يُنفَّذ بعد quiz_cycle.sql. تكرار التنفيذ آمن.

alter table public.quizzes drop constraint if exists quizzes_period_check;
alter table public.quizzes add constraint quizzes_period_check
  check (period in ('diagnostic', 'period1', 'period2', 'final', 'verify')) not valid;

alter table public.quiz_plans add column if not exists round smallint not null default 1;
alter table public.quiz_plans add column if not exists parent_id uuid references public.quiz_plans(id) on delete set null;
alter table public.quiz_plans add column if not exists verify_quiz_id uuid references public.quizzes(id) on delete set null;
alter table public.quiz_plans add column if not exists impact jsonb;          -- { n, improved, passed, below, missing, before, after, students:[...] } أو { skipped }
alter table public.quiz_plans add column if not exists measured_at timestamptz;
alter table public.quizzes add column if not exists verify_plan_id uuid references public.quiz_plans(id) on delete set null;

-- خطة واحدة من كل نوع في كل جولة (كانت واحدة لكل نوع)
alter table public.quiz_plans drop constraint if exists quiz_plans_quiz_id_kind_key;
create unique index if not exists quiz_plans_quiz_kind_round_uq on public.quiz_plans (quiz_id, kind, round);

-- الأثر لا يُكتب إلا من دالة القياس
create or replace function public.quiz_plans_impact_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if (case when tg_op = 'INSERT' then new.impact is not null or new.measured_at is not null
          else new.impact is distinct from old.impact or new.measured_at is distinct from old.measured_at end)
     and coalesce(current_setting('app.quiz_measure', true), '') <> '1' then
    raise exception 'يُقاس الأثر آليًا من اختبار التحقق';
  end if;
  return new;
end; $$;

drop trigger if exists quiz_plans_impact_guard on public.quiz_plans;
create trigger quiz_plans_impact_guard before insert or update on public.quiz_plans
  for each row execute function public.quiz_plans_impact_guard();
-- نهاية الجزء 1
