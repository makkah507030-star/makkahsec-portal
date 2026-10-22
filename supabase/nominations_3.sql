-- =====================================================================
-- الترشيحات (الجزء 3 من 4): صفحة ولي الأمر (طلبات أبنائه وموافقته)، وقائمة المتقدمين
-- لصاحب الإعلان. يُشغَّل بعد الجزء 2.
-- =====================================================================

-- طلبات أبناء ولي الأمر (ومنهم أبناء المنسوبين المربوطون بحساباتهم)
create or replace function public.nom_guardian_calls() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('student', s.full_name,
      'call', to_jsonb(c) - 'owner_id' - 'criteria' - 'questions',
      'app', public.nom_public_app(a, c)) order by a.created_at desc), '[]')
    from guardians g join guardian_student gs on gs.guardian_id = g.id
    join students s on s.id = gs.student_id
    join nom_applications a on a.student_id = s.id
    join nom_calls c on c.id = a.call_id and c.cancelled_at is null
   where g.user_id = auth.uid() and g.is_active;
$$;

create or replace function public.nom_guardian_ok(p_app uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update nom_applications a set guardian_ok_at = now(), updated_at = now()
   where a.id = p_app and a.guardian_ok_at is null
     and exists (select 1 from guardians g join guardian_student gs on gs.guardian_id = g.id
                  where g.user_id = auth.uid() and g.is_active and gs.student_id = a.student_id);
  if not found then raise exception 'لا يمكن الموافقة على هذا الطلب'; end if;
end $$;

-- المتقدمون على الإعلان، بفصولهم وشروطهم وإجاباتهم، ومعرّفات حسابات الطالب وأولياء أمره (للإشعارات)
create or replace function public.nom_applicants(p_call uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.nom_owns(p_call) then raise exception 'غير مصرّح'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'student_id', a.student_id, 'name', s.full_name, 'grade', v.grade, 'class_no', v.class_no,
      'answers', a.answers, 'eligibility', a.eligibility, 'stage', a.stage, 'guardian_ok_at', a.guardian_ok_at,
      'interview_at', a.interview_at, 'interview_place', a.interview_place, 'scores', a.scores,
      'interview_note', a.interview_note, 'created_at', a.created_at,
      'notify', (select coalesce(jsonb_agg(x.uid), '[]') from (
          select s.user_id uid where s.user_id is not null
          union select g.user_id from guardian_student gs join guardians g on g.id = gs.guardian_id
           where gs.student_id = s.id and g.user_id is not null and g.is_active) x)
    ) order by a.created_at)
    from nom_applications a join students s on s.id = a.student_id
    left join v_active_students v on v.student_id = s.id
   where a.call_id = p_call), '[]');
end $$;

-- عدد المتقدمين لكل إعلان (لقائمة الإعلانات)
create or replace function public.nom_counts() returns table (call_id uuid, total int, shortlisted int, accepted int)
language sql stable security definer set search_path = public as $$
  select a.call_id, count(*) filter (where a.stage <> 'withdrawn')::int,
         count(*) filter (where a.interview_at is not null and a.stage <> 'withdrawn')::int,
         count(*) filter (where a.stage = 'accepted')::int
    from nom_applications a where public.nom_owns(a.call_id) group by a.call_id;
$$;

revoke all on function public.nom_guardian_calls(), public.nom_guardian_ok(uuid), public.nom_applicants(uuid), public.nom_counts() from public, anon;
grant execute on function public.nom_guardian_calls(), public.nom_guardian_ok(uuid), public.nom_applicants(uuid), public.nom_counts() to authenticated;
-- نهاية الجزء 3
