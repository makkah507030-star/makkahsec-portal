-- =====================================================================
-- عدّاد استخدام النماذج وخدمات الاستوديو — للدعم الفني وحده.
--
-- • النماذج الرسمية ونماذج السلوك والمواظبة والإحالة تُحسب من سجلاتها
--   المحفوظة أصلًا (بأثر رجعي من أول استخدام).
-- • قوالب الاستوديو وشهادة تعريف طالب منتظم لا تُحفظ عند الطباعة، فيُسجَّل
--   لكل طباعة أو تنزيل أو حفظ صفّ في usage_events من تاريخ تنفيذ هذا الملف.
-- • لا يقرأ الأرقام إلا الدعم الفني، عبر الدالة usage_report (لا المدير).
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  category text not null,          -- studio | certificate
  item_key text not null,          -- مفتاح القالب
  action text not null,            -- print | png | save | download
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.usage_events drop constraint if exists usage_events_category_check;
alter table public.usage_events add constraint usage_events_category_check
  check (category in ('studio', 'certificate'));

create index if not exists usage_events_item_idx on public.usage_events (category, item_key, created_at desc);

alter table public.usage_events enable row level security;

-- يسجّل المستخدم استخدامه هو فقط، ولا أحد يقرأ الجدول مباشرة
drop policy if exists usage_events_insert_own on public.usage_events;
create policy usage_events_insert_own on public.usage_events as PERMISSIVE for INSERT to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- التقرير: صفّ لكل نموذج — مرات الاستخدام في الفترة، والمستخدمون المختلفون،
-- وآخر استخدام، والاستخدام في آخر 30 يومًا، ومرات الطباعة (للنماذج الرسمية).
-- p_from / p_to اختياريان (بلا قيمة = كل الفترة).
-- ---------------------------------------------------------------------
drop function if exists public.usage_report(timestamptz, timestamptz);
create or replace function public.usage_report(p_from timestamptz default null, p_to timestamptz default null)
returns table (
  category text, item_key text, item_title text, active boolean,
  uses bigint, users bigint, last_used timestamptz, uses_30d bigint, prints bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_tech_support() then
    raise exception 'التقرير للدعم الفني فقط' using errcode = '42501';
  end if;

  return query
  -- النماذج والشهادات الرسمية (كل قالب، ولو لم يُستخدم)
  select 'form'::text, t.key, t.title, t.is_active,
         count(d.id) filter (where (p_from is null or d.created_at >= p_from) and (p_to is null or d.created_at < p_to)),
         count(distinct d.created_by) filter (where (p_from is null or d.created_at >= p_from) and (p_to is null or d.created_at < p_to)),
         max(d.created_at),
         count(d.id) filter (where d.created_at >= now() - interval '30 days'),
         count(d.printed_at) filter (where (p_from is null or d.created_at >= p_from) and (p_to is null or d.created_at < p_to))
  from public.form_templates t
  left join public.form_documents d on d.template_id = t.id
  group by t.key, t.title, t.is_active

  union all
  -- نماذج السلوك والمواظبة
  select 'behavior'::text, b.kind, null::text, true,
         count(*) filter (where (p_from is null or b.created_at >= p_from) and (p_to is null or b.created_at < p_to)),
         count(distinct b.issued_by) filter (where (p_from is null or b.created_at >= p_from) and (p_to is null or b.created_at < p_to)),
         max(b.created_at),
         count(*) filter (where b.created_at >= now() - interval '30 days'),
         null::bigint
  from public.behavior_forms b
  group by b.kind

  union all
  -- إحالة طالب
  select 'referral'::text, 'referral'::text, null::text, true,
         count(*) filter (where (p_from is null or r.created_at >= p_from) and (p_to is null or r.created_at < p_to)),
         count(distinct r.teacher_id) filter (where (p_from is null or r.created_at >= p_from) and (p_to is null or r.created_at < p_to)),
         max(r.created_at),
         count(*) filter (where r.created_at >= now() - interval '30 days'),
         null::bigint
  from public.student_referrals r

  union all
  -- قوالب الاستوديو وشهادة تعريف طالب منتظم (الطباعة = طباعة + PNG + تنزيل ملف)
  select e.category, e.item_key, null::text, true,
         count(*) filter (where (p_from is null or e.created_at >= p_from) and (p_to is null or e.created_at < p_to)),
         count(distinct e.user_id) filter (where (p_from is null or e.created_at >= p_from) and (p_to is null or e.created_at < p_to)),
         max(e.created_at),
         count(*) filter (where e.created_at >= now() - interval '30 days'),
         count(*) filter (where e.action <> 'save' and (p_from is null or e.created_at >= p_from) and (p_to is null or e.created_at < p_to))
  from public.usage_events e
  group by e.category, e.item_key;
end;
$$;

revoke all on function public.usage_report(timestamptz, timestamptz) from public, anon;
grant execute on function public.usage_report(timestamptz, timestamptz) to authenticated;
