-- =====================================================================
-- صندوق الطلاب المفقودين: إجراء رابع «التحويل للموجه الطلابي»
--
-- • الإجراء يُسجَّل في admin_missing_notes بالقيمة to_counselor.
-- • ويُنشئ إحالة من نوع missing يصدرها الوكيل مباشرة لموجه صف الطالب
--   (الصف الأول ← الموجه 1، والثاني ← 2، والثالث ← 3)، ثم تسير في مسار
--   الإحالة نفسه: إجراء الموجه ← اعتماد الوكيل ← إشعار ولي الأمر.
-- • ويُحفظ في الإحالة مسار الطالب في اليوم حتى وقت الفقد (day_timeline).
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

alter table public.admin_missing_notes drop constraint if exists admin_missing_notes_action_check;
alter table public.admin_missing_notes add constraint admin_missing_notes_action_check
  check (action in ('escaped', 'parent_permission', 'no_entry', 'to_counselor'));

alter table public.student_referrals drop constraint if exists student_referrals_kind_check;
alter table public.student_referrals add constraint student_referrals_kind_check
  check (kind in ('teacher', 'behavior', 'missing'));

-- مسار الطالب في اليوم حتى وقت الفقد (البصمة، وكل حصة بمادتها ومعلمها وحالتها)،
-- يُحفظ لحظة التحويل ليدرسه الموجه كما كان
alter table public.student_referrals add column if not exists day_timeline jsonb;

-- الوكيل (ومعه المدير والدعم الفني) يصدر إحالة المخالفة السلوكية وإحالة الطالب المفقود باسمه
drop policy if exists "deputy creates behavior referral" on public.student_referrals;
create policy "deputy creates behavior referral" on public.student_referrals
  as permissive for insert to authenticated
  with check (
    kind in ('behavior', 'missing')
    and deputy_id = (select auth.uid())
    and (select public.has_admin_role(array['principal', 'tech_support', 'deputy_students']))
  );

-- للتحقق
select conname, pg_get_constraintdef(oid) from pg_constraint
where conname in ('admin_missing_notes_action_check', 'student_referrals_kind_check');
