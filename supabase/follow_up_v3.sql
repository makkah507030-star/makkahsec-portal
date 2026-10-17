-- =====================================================================
-- سجل المتابعة الإلكتروني 3 (تجريبي في الفصل الدراسي الأول): توزيع المعلم
-- درجات الفترة على بنود يسمّيها، كل بند تحت عمود من أعمدة نور للمادة.
--
-- • جدول مستقل عن توزيع السجل 2 (teacher_follow_up_weights)، فلا يمحو أحدهما الآخر.
-- • لكل معلم × مادة × عام × فصل دراسي، وفيه توزيع لكل بنية أعمدة (src/lib/followUp3.js):
--   { "v": 2, "dists": { "<بنية الأعمدة>": [ {"id", "label", "max", "type", "col"}, … ] } }
-- • الرصد في teacher_follow_up القائم ببنود r3_*، فلا يتأثر السجلان 1 و2.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.teacher_follow_up_dist3 (
  teacher_id    uuid not null references public.teachers(id) on delete cascade,
  subject       text not null,
  academic_year text not null,
  term          integer not null,
  weights       jsonb not null check (jsonb_typeof(weights) = 'object'),
  updated_at    timestamptz not null default now(),
  primary key (teacher_id, subject, academic_year, term)
);

alter table public.teacher_follow_up_dist3 enable row level security;

drop policy if exists "teacher manage own follow-up dist3" on public.teacher_follow_up_dist3;
create policy "teacher manage own follow-up dist3" on public.teacher_follow_up_dist3
  for all to authenticated
  using (teacher_id in (select t.id from public.teachers t where t.user_id = (select auth.uid())))
  with check (teacher_id in (select t.id from public.teachers t where t.user_id = (select auth.uid())));

-- نهاية الملف
