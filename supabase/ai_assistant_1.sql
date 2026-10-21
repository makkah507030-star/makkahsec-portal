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
-- القراءة للدعم الفني وحده (التكلفة لا تظهر لغيره)، والمعلم يعرف حصته من ai_my_quota.
-- الإضافة من دالة الخادم وحدها (لا سياسة إضافة)
drop policy if exists "ai usage read" on public.ai_usage;
create policy "ai usage read" on public.ai_usage for select to authenticated
  using (public.has_admin_role(array['tech_support']));
grant select on public.ai_usage to authenticated;

-- الحد الشهري لكل معلم: 10 طلبات (يعدّله الدعم الفني من «تقرير المساعد الذكي»)
insert into public.settings (key, value) values ('ai_monthly_limit', '10')
on conflict (key) do nothing;

-- حصتي هذا الشهر (بتوقيت مكة): العدد والحد فقط، بلا تكلفة
create or replace function public.ai_my_quota()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'used', (select count(*) from ai_usage where user_id = auth.uid()
               and created_at >= date_trunc('month', now() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh'),
    'limit', coalesce((select value::int from settings where key = 'ai_monthly_limit'), 10));
$$;
revoke all on function public.ai_my_quota() from public, anon;
grant execute on function public.ai_my_quota() to authenticated;

-- تقرير الدعم الفني: لكل معلم في الفترة الطلبات والأسئلة والتكلفة وآخر طلب
create or replace function public.ai_usage_report(p_from timestamptz, p_to timestamptz)
returns table (user_id uuid, name text, requests int, questions int, cost_usd numeric, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role(array['tech_support']) then raise exception 'غير مصرّح'; end if;
  return query
  select a.user_id, coalesce(max(t.full_name), max(u.full_name))::text, count(*)::int, coalesce(sum(a.items), 0)::int,
         coalesce(sum(a.cost_usd), 0), max(a.created_at)
    from ai_usage a left join users u on u.id = a.user_id left join teachers t on t.user_id = a.user_id
   where a.created_at >= p_from and a.created_at < p_to
   group by a.user_id order by 5 desc;
end $$;

-- تعديل الحد الشهري (الدعم الفني)
create or replace function public.ai_set_limit(p_limit int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role(array['tech_support']) then raise exception 'غير مصرّح'; end if;
  if p_limit is null or p_limit < 0 or p_limit > 500 then raise exception 'الحد من 0 إلى 500'; end if;
  insert into settings (key, value) values ('ai_monthly_limit', p_limit::text)
  on conflict (key) do update set value = excluded.value;
end $$;
revoke all on function public.ai_usage_report(timestamptz, timestamptz), public.ai_set_limit(int) from public, anon;
grant execute on function public.ai_usage_report(timestamptz, timestamptz), public.ai_set_limit(int) to authenticated;

-- للتحقق
select public.ai_my_quota() is not null as ready, (select value from settings where key = 'ai_monthly_limit') as monthly_limit;
-- نهاية الجزء 1
