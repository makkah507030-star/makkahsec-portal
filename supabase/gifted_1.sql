-- =====================================================================
-- برنامج الموهوبين (الجزء 1): متابعة البرنامج الوطني للكشف عن الموهوبين (مقياس موهبة)
-- لطلاب الأول الثانوي — المستوى الثالث من المقياس، ويُدخل مرة واحدة في المستوى.
-- • mawhiba_tracking: حالة كل طالب في العام الدراسي: لم يسجّل، اختُبر سابقًا (في الثالث
--   المتوسط)، سجّل، أكّد (دفع الرسوم أو ترشيح مدعوم)، اختُبر، موهوب، لم يُكتشف؛ مع موعد
--   المقياس ومركزه والدرجة وجوال الطالب وملاحظة.
-- • صلاحية «برنامج الموهوبين» (gifted) تُسند لدور البرنامج هنا، والمدير والدعم الفني دائمًا.
-- • gifted_roster: جوال ولي الأمر لطلاب الصف، لمن يملك الصلاحية وحده.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.mawhiba_tracking (
  student_id     uuid not null references public.students(id) on delete cascade,
  academic_year  text not null,
  status         text not null default 'none'
    check (status in ('none', 'prior', 'registered', 'confirmed', 'tested', 'gifted', 'not_gifted')),
  pay            text check (pay in ('paid', 'supported')),     -- دفع الرسوم أو ترشيح مدعوم
  test_date      date,
  test_center    text,
  score          numeric,
  note           text,
  student_mobile text check (student_mobile is null or student_mobile ~ '^9665[0-9]{8}$'),
  updated_by_name text,
  updated_at     timestamptz not null default now(),
  primary key (student_id, academic_year)
);
alter table public.mawhiba_tracking enable row level security;

drop policy if exists mawhiba_read on public.mawhiba_tracking;
create policy mawhiba_read on public.mawhiba_tracking for select to authenticated
  using (public.has_permission('gifted') or public.is_admin());
drop policy if exists mawhiba_write on public.mawhiba_tracking;
create policy mawhiba_write on public.mawhiba_tracking for all to authenticated
  using (public.has_permission('gifted')) with check (public.has_permission('gifted'));

insert into public.role_permissions (role_type, permission)
values ('gifted_program', 'gifted') on conflict do nothing;

-- جوال ولي الأمر لطلاب الصف (للتذكير بالواتساب)
create or replace function public.gifted_roster(p_grade int)
returns table (student_id uuid, mobile text)
language sql stable security definer set search_path = public as $$
  select v.student_id,
         (select g.mobile from guardian_student gs join guardians g on g.id = gs.guardian_id
           where gs.student_id = v.student_id and coalesce(g.mobile, '') <> ''
           order by gs.is_primary desc, g.is_active desc limit 1)
    from v_active_students v
   where v.grade = p_grade and public.has_permission('gifted');
$$;
revoke execute on function public.gifted_roster(int) from public, anon;
grant execute on function public.gifted_roster(int) to authenticated;

-- للتحقق
select count(*) as "سجلات المتابعة",
       exists (select 1 from public.role_permissions where role_type = 'gifted_program' and permission = 'gifted') as "الصلاحية مسندة"
  from public.mawhiba_tracking;
-- نهاية الجزء 1
