-- =====================================================================
--  بوابة مكة الثانوية الرقمية
--  مركز تقارير شؤون الطلاب — اعتماد الغياب الرسمي والإنذارات
--
--  طريقة التنفيذ: Supabase ← SQL Editor ← الصق الملف كاملًا ← Run.
--
--  هذا الملف إضافي بالكامل وآمن لإعادة التنفيذ:
--    • يُنشئ جداول ودوالّ جديدة فقط (IF NOT EXISTS / CREATE OR REPLACE).
--    • لا يحذف ولا يعدّل أي جدول أو بيانات قائمة (البصمات، تحضير الحصص،
--      الاستئذان، الإحالات… تبقى كما هي).
--    • يقرأ فقط من: users, admin_roles, role_permissions, students.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) اليوم المعتمد: النسبة الرسمية (بعد الحصة الثانية) والنسبة المكتملة
-- ---------------------------------------------------------------------
create table if not exists public.official_attendance_days (
  attend_date      date primary key,
  academic_year    text,
  term             int,

  -- الاعتماد الرسمي (الحصتان الأولى والثانية + البصمة)
  total            int not null default 0,
  present          int not null default 0,
  absent           int not null default 0,
  excused          int not null default 0,
  pending          int not null default 0,
  official_pct     numeric(5,2),
  by_grade         jsonb not null default '{}'::jsonb,  -- {"1": {"total":..,"present":..,"absent":..,"excused":..,"pending":..}}
  late_count       int,                                   -- التأخر الصباحي لليوم
  approved_at      timestamptz not null default now(),
  approved_by      uuid,
  approved_by_name text,
  retroactive      boolean not null default false,        -- اعتُمد بأثر رجعي من السجلات السابقة

  -- آخر تعديل بعد الاعتماد (تصحيح حالة طالب)
  updated_at       timestamptz,
  updated_by       uuid,
  updated_by_name  text,

  -- النسبة المكتملة للإحصاء (حضور أي حصة خلال اليوم)
  final_present    int,
  final_absent     int,
  final_excused    int,
  final_pending    int,
  final_pct        numeric(5,2),
  final_by_grade   jsonb,
  final_at         timestamptz
);

-- ---------------------------------------------------------------------
-- 2) حالات الطلاب في اليوم المعتمد
--    تُحفظ الحالات غير الحاضرة (غائب/بعذر/لم يُحضَّر) والمتأخرون صباحًا
--    + أي تصحيح يدوي. الحاضر غير المتأخر لا يُحفظ (يُحسب من الإجمالي).
--    manual = true: قرار الوكيل، لا يُستبدل عند إعادة الاعتماد.
-- ---------------------------------------------------------------------
create table if not exists public.official_day_marks (
  attend_date   date not null references public.official_attendance_days(attend_date) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  status        text not null check (status in ('present', 'absent', 'excused', 'pending')),
  punched       boolean not null default false,   -- بصم صباحًا (غائب + بصم = حالة متابعة)
  full_name     text,
  national_id   text,
  class_no      int,
  grade         int,
  manual        boolean not null default false,
  note          text,
  edited_by_name text,
  edited_at     timestamptz,
  primary key (attend_date, student_id)
);
create index if not exists official_day_marks_student_idx
  on public.official_day_marks (student_id, status);

-- التأخر الصباحي (بصمة بعد بداية الاصطفاف الصباحي + 5 دقائق):
-- يُحفظ للمتأخر ولو كان حاضرًا، لتقارير التأخر التراكمية.
alter table public.official_day_marks add column if not exists punch_time   timestamptz;
alter table public.official_day_marks add column if not exists late_minutes int;
create index if not exists official_day_marks_late_idx
  on public.official_day_marks (attend_date) where late_minutes > 0;

-- ---------------------------------------------------------------------
-- 3) الإنذارات والمحاضر
--    warn1 = إنذار أول + محضر (10 أيام)
--    warn2 = إنذار ثانٍ + محضر (15 يومًا)
--    transfer = محضر تحويل لوكيل شؤون الطلاب (مع الإنذار الثاني)
--    source = 'paper' لما صدر ورقيًا قبل النظام ويُسجَّل بتاريخه الأصلي.
-- ---------------------------------------------------------------------
create table if not exists public.absence_warnings (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.students(id) on delete cascade,
  stage          text not null check (stage in ('warn1', 'warn2', 'transfer')),
  days_count     int not null,
  academic_year  text,
  term           int,
  issued_on      date not null default current_date,
  source         text not null default 'system' check (source in ('system', 'paper')),
  note           text,
  issued_at      timestamptz not null default now(),
  issued_by      uuid,
  issued_by_name text
);
create unique index if not exists absence_warnings_once_idx
  on public.absence_warnings (student_id, stage, coalesce(academic_year, ''), coalesce(term, 0));


-- ---------------------------------------------------------------------
-- 4) الصلاحيات
-- ---------------------------------------------------------------------
-- القراءة: كل حساب إداري فعّال
create or replace function public.sa_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin' and coalesce(u.is_active, true)
  );
$$;

-- الكتابة: المدير والدعم الفني ووكيل شؤون الطلاب، أو من له صلاحية التقارير
create or replace function public.sa_can_manage()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
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

create or replace function public.sa_my_name()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(full_name, username) from public.users where id = auth.uid();
$$;

alter table public.official_attendance_days enable row level security;
alter table public.official_day_marks       enable row level security;
alter table public.absence_warnings         enable row level security;

drop policy if exists sa_days_read  on public.official_attendance_days;
drop policy if exists sa_days_write on public.official_attendance_days;
create policy sa_days_read  on public.official_attendance_days for select using (public.sa_is_staff());
create policy sa_days_write on public.official_attendance_days for all
  using (public.sa_can_manage()) with check (public.sa_can_manage());

drop policy if exists sa_marks_read  on public.official_day_marks;
drop policy if exists sa_marks_write on public.official_day_marks;
create policy sa_marks_read  on public.official_day_marks for select using (public.sa_is_staff());
create policy sa_marks_write on public.official_day_marks for all
  using (public.sa_can_manage()) with check (public.sa_can_manage());

drop policy if exists sa_warn_read  on public.absence_warnings;
drop policy if exists sa_warn_write on public.absence_warnings;
create policy sa_warn_read  on public.absence_warnings for select using (public.sa_is_staff());
create policy sa_warn_write on public.absence_warnings for all
  using (public.sa_can_manage()) with check (public.sa_can_manage());


-- ---------------------------------------------------------------------
-- 5) إعادة احتساب أرقام اليوم من حالات الطلاب (بعد أي تعديل)
-- ---------------------------------------------------------------------
create or replace function public.sa_recount_day(p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare
  d public.official_attendance_days;
  v_abs int; v_exc int; v_pen int; v_pre int;
  v_grades jsonb := '{}'::jsonb;
  g record;
begin
  select * into d from public.official_attendance_days where attend_date = p_date;
  if not found then return; end if;

  select count(*) filter (where status = 'absent'),
         count(*) filter (where status = 'excused'),
         count(*) filter (where status = 'pending')
    into v_abs, v_exc, v_pen
    from public.official_day_marks where attend_date = p_date;
  v_pre := greatest(d.total - v_abs - v_exc - v_pen, 0);

  -- الصفوف: الإجمالي محفوظ من الاعتماد، والباقي يُعاد عدّه
  for g in select key as grade, (value->>'total')::int as total from jsonb_each(d.by_grade) loop
    v_grades := v_grades || jsonb_build_object(g.grade, (
      select jsonb_build_object(
        'total',   g.total,
        'absent',  count(*) filter (where m.status = 'absent'),
        'excused', count(*) filter (where m.status = 'excused'),
        'pending', count(*) filter (where m.status = 'pending'),
        'present', greatest(g.total - count(*) filter (where m.status in ('absent','excused','pending')), 0))
      from public.official_day_marks m
      where m.attend_date = p_date and m.grade::text = g.grade));
  end loop;

  update public.official_attendance_days set
    absent = v_abs, excused = v_exc, pending = v_pen, present = v_pre,
    official_pct = case when d.total - v_pen > 0
                        then round(v_pre * 100.0 / (d.total - v_pen), 2) end,
    by_grade = v_grades
  where attend_date = p_date;
end;
$$;


-- ---------------------------------------------------------------------
-- 6) حفظ الاعتماد (أو النسبة المكتملة) في معاملة واحدة
--    p_mode = 'approve' : الأرقام الرسمية + حالات الطلاب
--             (تُستبدل الحالات الآلية، وتبقى تصحيحات الوكيل اليدوية)
--    p_mode = 'final'   : النسبة المكتملة فقط، ولا تمسّ الاعتماد الرسمي
-- ---------------------------------------------------------------------
create or replace function public.sa_save_official_day(
  p_date date, p_day jsonb, p_marks jsonb, p_mode text default 'approve'
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_name text := public.sa_my_name();
begin
  if not public.sa_can_manage() then
    raise exception 'غير مصرّح: اعتماد الغياب لوكيل شؤون الطلاب والإدارة';
  end if;

  if p_mode = 'final' then
    update public.official_attendance_days set
      final_present  = (p_day->>'present')::int,
      final_absent   = (p_day->>'absent')::int,
      final_excused  = (p_day->>'excused')::int,
      final_pending  = (p_day->>'pending')::int,
      final_pct      = nullif(p_day->>'pct', '')::numeric,
      final_by_grade = p_day->'by_grade',
      final_at       = now()
    where attend_date = p_date;
    if not found then
      raise exception 'اعتمد الغياب الرسمي لهذا اليوم أولًا';
    end if;
    return;
  end if;

  insert into public.official_attendance_days as d (
    attend_date, academic_year, term, total, by_grade, late_count,
    approved_at, approved_by, approved_by_name, retroactive)
  values (
    p_date, p_day->>'academic_year', nullif(p_day->>'term', '')::int,
    (p_day->>'total')::int, coalesce(p_day->'by_grade', '{}'::jsonb),
    nullif(p_day->>'late_count', '')::int,
    now(), auth.uid(), v_name, coalesce((p_day->>'retroactive')::boolean, false))
  on conflict (attend_date) do update set
    academic_year = excluded.academic_year,
    term          = excluded.term,
    total         = excluded.total,
    by_grade      = excluded.by_grade,
    late_count    = excluded.late_count,
    -- أول اعتماد يبقى مسجّلًا؛ إعادة الاعتماد تُسجَّل كتعديل
    updated_at      = now(),
    updated_by      = auth.uid(),
    updated_by_name = v_name;

  delete from public.official_day_marks where attend_date = p_date and not manual;

  insert into public.official_day_marks (
    attend_date, student_id, status, punched, full_name, national_id, class_no, grade,
    punch_time, late_minutes)
  select p_date, (m->>'student_id')::uuid, m->>'status',
         coalesce((m->>'punched')::boolean, false),
         m->>'full_name', m->>'national_id',
         nullif(m->>'class_no', '')::int, nullif(m->>'grade', '')::int,
         nullif(m->>'punch_time', '')::timestamptz, nullif(m->>'late_minutes', '')::int
  from jsonb_array_elements(coalesce(p_marks, '[]'::jsonb)) m
  where m->>'status' in ('absent', 'excused', 'pending')
     or (m->>'status' = 'present' and coalesce(nullif(m->>'late_minutes', '')::int, 0) > 0)
  on conflict (attend_date, student_id) do update set   -- التصحيح اليدوي: تبقى حالته ويُحدَّث التأخر
    punched = excluded.punched, punch_time = excluded.punch_time,
    late_minutes = excluded.late_minutes;

  perform public.sa_recount_day(p_date);
end;
$$;


-- ---------------------------------------------------------------------
-- 7) تصحيح حالة طالب بعد الاعتماد (قرار الوكيل)
-- ---------------------------------------------------------------------
create or replace function public.sa_override_mark(
  p_date date, p_student jsonb, p_status text, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sa_can_manage() then
    raise exception 'غير مصرّح: تعديل الغياب الرسمي لوكيل شؤون الطلاب والإدارة';
  end if;
  if p_status not in ('present', 'absent', 'excused') then
    raise exception 'حالة غير صالحة: %', p_status;
  end if;
  if not exists (select 1 from public.official_attendance_days where attend_date = p_date) then
    raise exception 'هذا اليوم لم يُعتمد بعد';
  end if;

  insert into public.official_day_marks as m (
    attend_date, student_id, status, punched, full_name, national_id, class_no, grade,
    manual, note, edited_by_name, edited_at)
  values (
    p_date, (p_student->>'student_id')::uuid, p_status,
    coalesce((p_student->>'punched')::boolean, false),
    p_student->>'full_name', p_student->>'national_id',
    nullif(p_student->>'class_no', '')::int, nullif(p_student->>'grade', '')::int,
    true, p_note, public.sa_my_name(), now())
  on conflict (attend_date, student_id) do update set
    status = excluded.status, manual = true, note = excluded.note,
    edited_by_name = excluded.edited_by_name, edited_at = excluded.edited_at;

  update public.official_attendance_days set
    updated_at = now(), updated_by = auth.uid(), updated_by_name = public.sa_my_name()
  where attend_date = p_date;

  perform public.sa_recount_day(p_date);
end;
$$;

grant execute on function public.sa_save_official_day(date, jsonb, jsonb, text) to authenticated;
grant execute on function public.sa_override_mark(date, jsonb, text, text) to authenticated;
revoke execute on function public.sa_recount_day(date) from public;
