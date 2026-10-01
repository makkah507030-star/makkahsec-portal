-- =====================================================================
-- إحالة المخالفات السلوكية للموجه الطلابي (دليل السلوك والمواظبة 1447هـ)
-- يُنفَّذ مرة واحدة من Supabase ← SQL Editor.
--
-- • أعمدة المخالفة في جدول الإحالات: الدرجة والنوع والنص وتاريخها،
--   و kind لتمييز إحالة المخالفة (behavior) عن إحالة المعلم (teacher).
-- • يُسمح لوكيل شؤون الطلاب (ومعه المدير والدعم الفني) بإصدار الإحالة
--   مباشرة باسمه — إحالة المعلم بقيت كما هي.
-- =====================================================================

alter table public.student_referrals
  add column if not exists kind text not null default 'teacher',
  add column if not exists violation_degree integer,
  add column if not exists violation_type text,
  add column if not exists violation_text text,
  add column if not exists violation_date date;

alter table public.student_referrals drop constraint if exists student_referrals_kind_check;
alter table public.student_referrals add constraint student_referrals_kind_check
  check (kind in ('teacher', 'behavior'));

alter table public.student_referrals drop constraint if exists student_referrals_degree_check;
alter table public.student_referrals add constraint student_referrals_degree_check
  check (violation_degree is null or violation_degree between 1 and 5);

drop policy if exists "deputy creates behavior referral" on public.student_referrals;
create policy "deputy creates behavior referral" on public.student_referrals
  as permissive for insert to authenticated
  with check (
    kind = 'behavior'
    and deputy_id = auth.uid()
    and has_admin_role(array['principal', 'tech_support', 'deputy_students'])
  );
