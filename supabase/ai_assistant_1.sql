-- =====================================================================
-- مساعد المعلم بالذكاء الاصطناعي (الجزء 1): سجل الاستخدام والحصة الشهرية.
-- كل طلب توليد يُسجَّل هنا من دالة الخادم ai-assistant (بمفتاح الخدمة وحده):
-- من طلب، ولماذا، وبأي نموذج، وكم وحدة، وكم كلّف تقريبًا. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  task          text not null,              -- quiz_questions (توليد أسئلة الاختبار)
  ref_id        uuid,                       -- الاختبار أو الدرس المرتبط
  model         text,
  input_tokens  int,
  output_tokens int,
  cost_usd      numeric(10, 4),             -- تقدير بأسعار النموذج وقت الطلب
  items         int,                        -- عدد الأسئلة المولّدة
  created_at    timestamptz not null default now()
);
create index if not exists ai_usage_user_month on public.ai_usage (user_id, created_at);

alter table public.ai_usage enable row level security;
-- القراءة: صاحب الطلب، والمدير والدعم الفني للمتابعة. الإضافة من دالة الخادم وحدها (لا سياسة إضافة)
drop policy if exists "ai usage read" on public.ai_usage;
create policy "ai usage read" on public.ai_usage for select to authenticated
  using (user_id = auth.uid() or public.has_admin_role(array['principal', 'tech_support']));
grant select on public.ai_usage to authenticated;

-- الحد الشهري لكل معلم (يعدّله المدير أو الدعم الفني من الإعدادات)
insert into public.settings (key, value) values ('ai_monthly_limit', '30')
on conflict (key) do nothing;

-- حصتي هذا الشهر (بتوقيت مكة): المستخدم والحد
create or replace function public.ai_my_quota()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'used', (select count(*) from ai_usage where user_id = auth.uid()
               and created_at >= date_trunc('month', now() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh'),
    'limit', coalesce((select value::int from settings where key = 'ai_monthly_limit'), 30));
$$;
revoke all on function public.ai_my_quota() from public, anon;
grant execute on function public.ai_my_quota() to authenticated;

-- للتحقق
select public.ai_my_quota() is not null as ready, (select value from settings where key = 'ai_monthly_limit') as monthly_limit;
-- نهاية الجزء 1
