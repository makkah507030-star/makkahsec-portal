-- حلقة التحسين (الجزء 1 من 5): جدول التوصيات وخططها، وعمود التوصيات المؤكدة في تقييم الأداء.
-- • كل صف توصية في بند واحد (e01..e11) بخط أساس: درجة البند حين أُوصي به.
-- • مسارها: plan (تنتظر خطة المعلم) ← review (تنتظر اعتماد الزائر) ← active (خطة معتمدة بموعد متابعة)
--   ← closed (قيس أثرها من درجة البند في الزيارة أو التقييم التالي)، أو cancelled.
-- • التي لم يتحسّن بندها تُفتح لها دورة ثانية (cycle 2) بدعم أعلى، مرتبطة بالأولى (parent_id).
-- • لا كتابة مباشرة: الإنشاء والقياس من المحفّزات (الجزء 3)، والإجراءات من improve_act (الجزء 4).
-- تكرار التنفيذ آمن.

create table if not exists public.improvement_goals (
  id uuid primary key default gen_random_uuid(),
  teacher_user_id uuid not null references public.users(id) on delete cascade,
  owner_user_id uuid references public.users(id) on delete set null,   -- الزائر أو المدير: يعتمد الخطة ويتابعها
  academic_year text,
  source text not null check (source in ('visit', 'review')),
  source_id uuid not null,                                              -- الاستمارة أو التقييم الذي صدرت منه
  source_date date not null default current_date,
  element_key text not null check (element_key ~ '^e(0[1-9]|1[01])$'),
  baseline smallint check (baseline between 1 and 5),                   -- خط الأساس
  recommendation text not null,
  cycle smallint not null default 1,
  parent_id uuid references public.improvement_goals(id) on delete set null,
  status text not null default 'plan' check (status in ('plan', 'review', 'active', 'closed', 'cancelled')),
  plan_actions text,                                                    -- الإجراءات يكتبها المعلم
  plan_support text,                                                    -- الدعم المطلوب
  follow_up_date date,
  plan_sent_at timestamptz,
  plan_return_note text,                                                -- ملاحظة الزائر حين يعيد الخطة
  plan_approved_at timestamptz,
  progress_note text,                                                   -- ما نفّذه المعلم عند حلول الموعد
  progress_at timestamptz,
  result_score smallint check (result_score between 1 and 5),
  result_source text,
  result_source_id uuid,
  improved boolean,
  closed_at timestamptz,
  cancel_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists improvement_goals_src_uq on public.improvement_goals (source_id, element_key);
create index if not exists improvement_goals_teacher_idx on public.improvement_goals (teacher_user_id, status);
create index if not exists improvement_goals_owner_idx on public.improvement_goals (owner_user_id, status);
create index if not exists improvement_goals_due_idx on public.improvement_goals (status, follow_up_date);

alter table public.improvement_goals enable row level security;

-- يقرؤها المعلم صاحبها، ومتابعها، والمدير والدعم الفني
drop policy if exists improvement_goals_read on public.improvement_goals;
create policy improvement_goals_read on public.improvement_goals for select to authenticated
  using (teacher_user_id = auth.uid() or owner_user_id = auth.uid()
         or public.has_admin_role(array['principal', 'tech_support']));

-- التوصيات التي أكدها المدير في التقييم: [{ key, text, on }]، وتُنشأ عند الإرسال
alter table public.perf_reviews add column if not exists improve jsonb;
-- نهاية الجزء 1
