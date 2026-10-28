-- =====================================================================
-- برنامج الموهوبين (الجزء 2): الطلاب الموهوبون ووسمهم. يُنفَّذ بعد gifted_1.sql.
-- • gifted_members: الطلاب الموهوبون من كل الصفوف، بمصدر الاكتشاف (مقياس موهبة أو ترشيح
--   المدرسة) ومجالات موهبتهم وجوال الطالب.
-- • من صارت حالته «موهوب» في متابعة المقياس يُضاف هنا تلقائيًا.
-- • gifted_badge: وسم «موهوب» في بطاقة حساب الطالب، له ولولي أمره ولمنسوبي الإدارة.
-- • gifted_members_roster: جوال ولي الأمر لكل طالب موهوب، لمن يملك الصلاحية.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.gifted_members (
  student_id     uuid primary key references public.students(id) on delete cascade,
  source         text not null default 'school' check (source in ('mawhiba', 'school')),
  domains        text[] not null default '{}',             -- مجالات الموهبة
  discovered_year text,
  student_mobile text check (student_mobile is null or student_mobile ~ '^9665[0-9]{8}$'),
  note           text,
  added_by_name  text,
  added_at       timestamptz not null default now()
);
alter table public.gifted_members enable row level security;
drop policy if exists gifted_members_read on public.gifted_members;
create policy gifted_members_read on public.gifted_members for select to authenticated
  using (public.has_permission('gifted') or public.is_admin());
drop policy if exists gifted_members_write on public.gifted_members;
create policy gifted_members_write on public.gifted_members for all to authenticated
  using (public.has_permission('gifted')) with check (public.has_permission('gifted'));

-- «موهوب» في متابعة المقياس ← يُضاف إلى الطلاب الموهوبين (بجواله إن وُجد)
create or replace function public.mawhiba_to_gifted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'gifted' then
    insert into gifted_members (student_id, source, discovered_year, student_mobile, added_by_name)
    values (new.student_id, 'mawhiba', new.academic_year, new.student_mobile, 'مقياس موهبة')
    on conflict (student_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists mawhiba_to_gifted on public.mawhiba_tracking;
create trigger mawhiba_to_gifted after insert or update of status on public.mawhiba_tracking
  for each row execute function public.mawhiba_to_gifted();
insert into public.gifted_members (student_id, source, discovered_year, student_mobile, added_by_name)
select student_id, 'mawhiba', academic_year, student_mobile, 'مقياس موهبة' from public.mawhiba_tracking
 where status = 'gifted' on conflict (student_id) do nothing;

-- وسم «موهوب» في بطاقة الطالب: null إن لم يكن موهوبًا
create or replace function public.gifted_badge(p_student uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('source', m.source, 'domains', m.domains, 'year', m.discovered_year)
    from gifted_members m
   where m.student_id = p_student
     and (exists (select 1 from students s where s.id = p_student and s.user_id = auth.uid())
          or exists (select 1 from guardian_student gs join guardians g on g.id = gs.guardian_id
                      where gs.student_id = p_student and g.user_id = auth.uid())
          or public.has_permission('gifted') or public.is_admin());
$$;

create or replace function public.gifted_members_roster() returns table (student_id uuid, mobile text)
language sql stable security definer set search_path = public as $$
  select m.student_id, (select g.mobile from guardian_student gs join guardians g on g.id = gs.guardian_id
                         where gs.student_id = m.student_id and coalesce(g.mobile, '') <> ''
                         order by gs.is_primary desc, g.is_active desc limit 1)
    from gifted_members m where public.has_permission('gifted');
$$;
revoke all on function public.gifted_badge(uuid), public.gifted_members_roster() from public, anon;
grant execute on function public.gifted_badge(uuid), public.gifted_members_roster() to authenticated;

-- للتحقق
select count(*) as "الطلاب الموهوبون", count(*) filter (where source = 'mawhiba') as "من مقياس موهبة"
  from public.gifted_members;
-- نهاية الجزء 2
