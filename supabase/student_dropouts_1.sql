-- =====================================================================
-- الطلاب المنقطعون (الجزء 1 من 2): الجدول والصلاحيات وكشف طلاب الفصل
-- المعلم يبلّغ عن طالب من فصوله ← وكيل شؤون الطلاب يطوي قيده ويلغي تفعيله
-- ← يظهر في «الطلاب المنقطعون» ويمكن إعادته إن عاد للدراسة.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن. ثم نفّذ الجزء 2.
-- =====================================================================

create table if not exists public.student_dropouts (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students(id) on delete cascade,
  student_name     text,
  national_id      text,
  class_id         uuid,
  class_no         int,
  grade            int,
  reason           text not null check (reason in ('absent5', 'travel', 'transfer', 'other')),
  note             text,
  absent_days      int,            -- أيام الغياب الرسمي المتصلة لحظة البلاغ
  status           text not null default 'reported'
                   check (status in ('reported', 'withdrawn', 'dismissed', 'returned')),
  reported_by      uuid default auth.uid(),
  reported_by_name text,
  reported_at      timestamptz not null default now(),
  decided_by_name  text,           -- الوكيل: طي القيد أو رد البلاغ
  decided_at       timestamptz,
  decision_note    text,
  enrollment_id    uuid,           -- التسجيل الذي أُلغي تفعيله، ليُعاد كما كان
  user_was_active  boolean,
  returned_by_name text,
  returned_at      timestamptz,
  return_note      text
);
-- بلاغ مفتوح واحد للطالب (قيد الإجراء أو مطوي القيد)
create unique index if not exists student_dropouts_open_idx
  on public.student_dropouts (student_id) where status in ('reported', 'withdrawn');
create index if not exists student_dropouts_status_idx on public.student_dropouts (status, reported_at desc);

-- من يستكمل الإجراء: المدير ووكيل شؤون الطلاب والدعم الفني
create or replace function public.dr_can_manage()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_roles ar where ar.user_id = auth.uid()
                 and ar.role_type in ('principal', 'deputy_students', 'tech_support'));
$$;

-- أيام الغياب الرسمي المتصلة حتى آخر يوم معتمد (البعذر والحاضر يقطعان العدّ)
create or replace function public.dr_streak(p_student uuid)
returns int language sql stable security definer set search_path = public as $$
  with d as (
    select coalesce(m.status = 'absent', false) as ab,
           row_number() over (order by a.attend_date desc) as rn
    from public.official_attendance_days a
    left join public.official_day_marks m on m.attend_date = a.attend_date and m.student_id = p_student
    where a.attend_date >= current_date - 90
  )
  select coalesce(min(rn) - 1, (select count(*) from d))::int from d where not ab;
$$;

alter table public.student_dropouts enable row level security;
-- القراءة: المستكملون كل البلاغات، والمبلّغ بلاغاته. الكتابة عبر الدوال فقط (الجزء 2)
drop policy if exists dr_read on public.student_dropouts;
create policy dr_read on public.student_dropouts for select to authenticated
  using (public.dr_can_manage() or reported_by = auth.uid());

-- كشف طلاب فصل للإبلاغ: للمستكملين ولمن يدرّس الفصل في جدوله
create or replace function public.dropout_class_students(p_class uuid)
returns table (student_id uuid, full_name text, national_id text, absent_days int, open_status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.dr_can_manage() or exists (
    select 1 from public.schedule s join public.teachers t on t.id = s.teacher_id
    where t.user_id = auth.uid() and s.class_id = p_class)) then
    raise exception 'هذا الفصل ليس من فصولك';
  end if;
  return query
  select s.id, s.full_name, s.national_id, public.dr_streak(s.id),
         (select d.status from public.student_dropouts d
          where d.student_id = s.id and d.status in ('reported', 'withdrawn') limit 1)
  from public.student_enrollment e join public.students s on s.id = e.student_id
  where e.class_id = p_class and e.status = 'active' and s.is_active;
end $$;

revoke execute on function public.dr_can_manage() from public, anon;
revoke execute on function public.dr_streak(uuid) from public, anon;
revoke execute on function public.dropout_class_students(uuid) from public, anon;
grant execute on function public.dr_can_manage() to authenticated;
grant execute on function public.dr_streak(uuid) to authenticated;
grant execute on function public.dropout_class_students(uuid) to authenticated;
-- نهاية الجزء 1
