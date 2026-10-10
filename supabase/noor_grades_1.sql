-- =====================================================================
-- متابعة رصد درجات الفترات في نظام نور — الجزء 1 من 2: الجدول والصلاحيات.
-- • مصدر الاختبارات: «جداول الاختبارات» (exam_slots لكل فصل ومادة)، عدا النهائي.
-- • الحالة لكل فصل ومادة: done = تم الرصد، partial = رصد جزئي (لم يكتمل الفصل)،
--   ولا صف = لم يرصد. يدخلها وكيل الشؤون التعليمية أو الدعم الفني أو المدير يدويًا.
-- • grading_deadline: آخر يوم لرصد درجات الفترة.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

alter table public.exam_terms add column if not exists grading_deadline date;

create table if not exists public.noor_grade_entries (
  exam_slot_id uuid primary key references public.exam_slots(id) on delete cascade,
  status text not null check (status in ('done', 'partial')),
  note text,
  updated_by uuid default auth.uid(),
  updated_name text,
  updated_at timestamptz not null default now()
);

alter table public.noor_grade_entries enable row level security;

drop policy if exists noor_grade_entries_manage on public.noor_grade_entries;
create policy noor_grade_entries_manage on public.noor_grade_entries as PERMISSIVE for ALL to authenticated
  using (public.has_admin_role(array['principal', 'deputy_academic', 'tech_support']))
  with check (public.has_admin_role(array['principal', 'deputy_academic', 'tech_support']));

-- نهاية الجزء 1
