-- =====================================================================
-- أعذار الغياب (الجزء 1 من 2): يرفع الطالب أو ولي أمره عذر أيام غياب بمرفقه، فيقبله
-- وكيل شؤون الطلاب أو يرفضه. عند القبول يصير الغياب الرسمي لتلك الأيام «غائب بعذر» آليًا
-- (الجزء 2). يراه صاحبه والطالب وأولياء أمره، والوكيل والمساعدان الإداريان 1 و2 والمدير والدعم الفني.
-- تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.absence_excuses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  dates date[] not null check (cardinality(dates) between 1 and 15),
  kind text not null default 'medical' check (kind in ('medical', 'other')),
  reason text,
  file_path text, file_name text,
  requested_by uuid not null default auth.uid(),
  requester text not null default 'guardian' check (requester in ('student', 'guardian')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  decision_note text, decided_by_name text, decided_by_role text, decided_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.absence_excuses add column if not exists decided_by_role text;   -- صفة متخذ القرار
create index if not exists absence_excuses_student on public.absence_excuses (student_id, created_at desc);
create index if not exists absence_excuses_pending on public.absence_excuses (status) where status = 'pending';

-- من يتخذ القرار: وكيل شؤون الطلاب والمساعدان الإداريان 1 و2، ومعهم المدير والدعم الفني
create or replace function public.excuse_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['principal', 'deputy_students', 'clerk', 'clerk_2', 'tech_support']);
$$;
-- صلة المستخدم بالطالب: الطالب نفسه (student) أو ولي أمره (guardian)، وإلا null
create or replace function public.excuse_relation(p_student uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from students s where s.id = p_student and s.user_id = auth.uid()) then 'student'
    when exists (select 1 from guardian_student gs join guardians g on g.id = gs.guardian_id
                  where gs.student_id = p_student and g.user_id = auth.uid()) then 'guardian' end;
$$;

-- عند الرفع: صاحبه وصفته، وأيام غياب فعلية فقط، ثم إشعار الوكيل
create or replace function public.absence_excuse_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare rel text; uids uuid[]; nid uuid;
begin
  rel := public.excuse_relation(new.student_id);
  if rel is null then raise exception 'غير مصرّح'; end if;
  new.requested_by := auth.uid(); new.requester := rel; new.status := 'pending';
  new.decision_note := null; new.decided_by_name := null; new.decided_by_role := null; new.decided_at := null; new.created_at := now();
  select array_agg(distinct d order by d) into new.dates from unnest(new.dates) d
   where exists (select 1 from official_day_marks m where m.student_id = new.student_id and m.attend_date = d and m.status = 'absent')
      or exists (select 1 from class_attendance ca where ca.student_id = new.student_id and ca.attend_date = d and ca.status = 'absent');
  if new.dates is null then raise exception 'اختر أيام غياب مسجلة'; end if;
  select array_agg(distinct r.user_id) into uids from admin_roles r where r.role_type::text in ('deputy_students', 'clerk', 'clerk_2');
  if uids is not null then
    nid := public.send_notification('عذر غياب جديد',
      (case rel when 'guardian' then 'ولي أمر الطالب ' else 'الطالب ' end) || (select full_name from students where id = new.student_id)
        || ' · ' || cardinality(new.dates) || ' يوم', 'general', '/absence-excuses', null, uids, null, null, true);
    begin perform public.push_notification(nid); exception when others then null; end;
  end if;
  return new;
end $$;
drop trigger if exists absence_excuse_trg on public.absence_excuses;
create trigger absence_excuse_trg before insert on public.absence_excuses
  for each row execute function public.absence_excuse_trg();

alter table public.absence_excuses enable row level security;
drop policy if exists absence_excuses_read on public.absence_excuses;
create policy absence_excuses_read on public.absence_excuses for select to authenticated
  using (public.excuse_manager() or public.excuse_relation(student_id) is not null);
drop policy if exists absence_excuses_add on public.absence_excuses;
create policy absence_excuses_add on public.absence_excuses for insert to authenticated
  with check (public.excuse_relation(student_id) is not null);
-- لا تعديل مباشر: القرار من الدالة absence_excuse_decide (الجزء 2)
grant select, insert on public.absence_excuses to authenticated;
revoke all on function public.excuse_manager(), public.excuse_relation(uuid) from public, anon;
grant execute on function public.excuse_manager(), public.excuse_relation(uuid) to authenticated;

-- المرفقات: مخزن خاص، مجلد باسم الطالب؛ يرفعها الطالب أو ولي أمره، ويقرؤها هم والوكيل
insert into storage.buckets (id, name, public, file_size_limit)
values ('absence-excuses', 'absence-excuses', false, 8388608) on conflict (id) do nothing;
drop policy if exists "absence excuses read" on storage.objects;
create policy "absence excuses read" on storage.objects for select to authenticated
  using (bucket_id = 'absence-excuses' and (public.excuse_manager()
         or public.excuse_relation(((storage.foldername(name))[1])::uuid) is not null));
drop policy if exists "absence excuses add" on storage.objects;
create policy "absence excuses add" on storage.objects for insert to authenticated
  with check (bucket_id = 'absence-excuses' and public.excuse_relation(((storage.foldername(name))[1])::uuid) is not null);
-- نهاية الجزء 1
