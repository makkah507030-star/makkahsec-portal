-- =====================================================================
-- مركز تصحيح الحضور — الجزء 1 من 2: الجداول والصلاحية وإسكات الإشعار.
-- • attendance_corrections: سجل كل تعديل (الحصة والتأخر والرسمي) بسببه ومن عدّله ومتى.
-- • attendance_late_overrides: إلغاء التأخر الصباحي (waive) أو تسجيله (late) لطالب في يوم،
--   ويتقدّم على البصمة في كل الحسابات (التقارير والاعتماد اليدوي والآلي).
-- • الصلاحية «attendance_fix» تُسند للأدوار من شاشة الصلاحيات (والمدير والدعم الفني دائمًا)،
--   ومن يملكها يعيد اعتماد اليوم بعد التعديل (sa_can_manage).
-- • التعديل من المركز لا يرسل إشعار غياب لولي الأمر: محفّزا الإشعار يتخطّيان
--   ما يُكتب والمتغيّر app.att_fix = '1' (يضبطه المركز داخل عمليته وحدها).
-- يُنفَّذ في Supabase ← SQL Editor قبل الجزء 2، وتكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  attend_date date not null,
  student_id uuid not null,
  kind text not null check (kind in ('period', 'late', 'official')),
  period_no int,
  old_value text,
  new_value text,
  reason text not null,
  by_user uuid default auth.uid(),
  by_name text,
  at timestamptz not null default now()
);
create index if not exists attendance_corrections_day on public.attendance_corrections (attend_date, student_id);
alter table public.attendance_corrections enable row level security;
drop policy if exists attendance_corrections_read on public.attendance_corrections;
create policy attendance_corrections_read on public.attendance_corrections for select to authenticated
  using (public.is_admin());

create table if not exists public.attendance_late_overrides (
  attend_date date not null,
  student_id uuid not null,
  mode text not null check (mode in ('waive', 'late')),
  minutes int,
  reason text,
  by_name text,
  at timestamptz not null default now(),
  primary key (attend_date, student_id)
);
alter table public.attendance_late_overrides enable row level security;
drop policy if exists attendance_late_overrides_read on public.attendance_late_overrides;
create policy attendance_late_overrides_read on public.attendance_late_overrides for select to authenticated
  using (public.is_admin());
-- الكتابة في الجدولين من دوال المركز وحدها (الجزء 2)، فلا سياسات كتابة

-- إشعار الغياب لا يُرسل لما يكتبه المركز
drop trigger if exists trg_notify_absence on public.class_attendance;
create trigger trg_notify_absence after insert or update on public.class_attendance
  for each row when (coalesce(current_setting('app.att_fix', true), '') <> '1')
  execute function public.notify_absence();
drop trigger if exists trg_notify_official_absence on public.class_attendance;
create trigger trg_notify_official_absence after insert or update on public.class_attendance
  for each row when (coalesce(current_setting('app.att_fix', true), '') <> '1')
  execute function public.notify_official_absence();

-- من يملك «تصحيح الحضور» يعيد اعتماد اليوم بعد التعديل
create or replace function public.sa_can_manage()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission('attendance_fix') or exists (
    select 1 from public.admin_roles ar
    where ar.user_id = auth.uid()
      and (
        ar.role_type in ('principal', 'tech_support', 'deputy_students')
        or exists (
          select 1 from public.role_permissions rp
          where rp.role_type = ar.role_type and rp.permission = 'reports'
        )
      )
  );
$$;
-- نهاية الجزء 1
