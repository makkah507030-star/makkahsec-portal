-- =====================================================================
-- استوديو الوسائط (الجزء 2): موافقة التصوير السنوية وقائمة «لا يُصوَّر».
-- • media_consents: ردّ ولي الأمر لكل ابن في العام الدراسي الحالي (يوافق أو لا يوافق)،
--   ويستطيع تغييره متى شاء من حسابه.
-- • media_no_photo: من لا يُصوَّر هذا العام؛ من رفض وليّه ومن لم يردّ بعد، لمن يملك
--   صلاحية «استوديو الوسائط» وحده. فلا يُصوَّر الطالب إلا بموافقة صريحة.
-- يُنفَّذ بعد media_1.sql في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.media_consents (
  student_id    uuid not null references public.students(id) on delete cascade,
  academic_year text not null,
  allowed       boolean not null,
  by_user       uuid default auth.uid(), by_name text,
  updated_at    timestamptz not null default now(),
  primary key (student_id, academic_year)
);

create or replace function public.media_year() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select value from settings where key = 'active_year'), '');
$$;

-- ردّ ولي الأمر على موافقة التصوير لابنه هذا العام
create or replace function public.media_consent_set(p_student uuid, p_allowed boolean)
returns void language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  select g.full_name into nm from guardian_student gs join guardians g on g.id = gs.guardian_id
   where gs.student_id = p_student and g.user_id = auth.uid() limit 1;
  if nm is null then raise exception 'لست وليّ أمر هذا الطالب'; end if;
  insert into media_consents (student_id, academic_year, allowed, by_user, by_name, updated_at)
  values (p_student, media_year(), p_allowed, auth.uid(), nm, now())
  on conflict (student_id, academic_year) do update
    set allowed = excluded.allowed, by_user = excluded.by_user, by_name = excluded.by_name, updated_at = now();
end $$;

alter table public.media_consents enable row level security;
drop policy if exists media_consents_read on public.media_consents;
create policy media_consents_read on public.media_consents for select to authenticated
  using (public.media_manager() or exists (
    select 1 from public.guardian_student gs join public.guardians g on g.id = gs.guardian_id
     where gs.student_id = media_consents.student_id and g.user_id = auth.uid()));

-- كل طلاب المدرسة بحالة موافقتهم هذا العام: allowed / denied / none
create or replace function public.media_no_photo()
returns table (student_id uuid, full_name text, grade int, class_no int, status text, by_name text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select v.student_id, v.full_name, v.grade::int, v.class_no::int,
         case when c.allowed then 'allowed' when c.allowed = false then 'denied' else 'none' end,
         c.by_name, c.updated_at
    from v_active_students v
    left join media_consents c on c.student_id = v.student_id and c.academic_year = media_year()
   where public.media_manager();
$$;

revoke all on function public.media_year(), public.media_consent_set(uuid, boolean), public.media_no_photo() from public, anon;
grant execute on function public.media_year(), public.media_consent_set(uuid, boolean), public.media_no_photo() to authenticated;

-- للتحقق
select media_year() as "العام", count(*) as "الردود",
       count(*) filter (where allowed) as "موافق", count(*) filter (where not allowed) as "غير موافق"
  from public.media_consents where academic_year = media_year();
-- نهاية الجزء 2
