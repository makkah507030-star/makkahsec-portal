-- =====================================================================
-- حدث للمدرسة كلها حسب الفئة (الجزء ١ من ٢): الأعمدة والعدّ.
--
-- audience          الفئات: teachers / students / guardians / admin (أكثر من فئة ممكنة).
--                   الفئة تُحسب آليًا، فلا تُدرج أسطر في event_participants.
-- audience_counts   أعداد الفئات لحظة ضبطها، وتُحدَّث مع كل انتقال مرحلة حتى الاعتماد
--                   فتثبت بأعداد يوم إكمال الحدث: {teachers, students, guardians, admin, staff}.
--                   staff = المعلمون والإدارة بلا تكرار لمن جمع الصفتين.
-- audience_attended من حضر من المعلمين والإدارة بالاسم: [{key, name, kind, role}]،
--                   ولهم وحدهم تصدر الشهادات. الطلاب وأولياء الأمور لا يُسجَّلون بالاسم.
--
-- يُنفَّذ في Supabase ← SQL Editor قبل الجزء ٢، وتكرار تنفيذه آمن.
-- =====================================================================

alter table public.school_events add column if not exists audience          text[] not null default '{}';
alter table public.school_events add column if not exists audience_counts   jsonb  not null default '{}'::jsonb;
alter table public.school_events add column if not exists audience_attended jsonb  not null default '[]'::jsonb;

alter table public.school_events drop constraint if exists school_events_audience_check;
alter table public.school_events add constraint school_events_audience_check
  check (audience <@ array['teachers', 'students', 'guardians', 'admin']);

-- أعداد الفئات. الطلاب: المنتظمون في السنة الحالية. أولياء الأمور: النشطون المرتبطون بهم.
-- المعلمون: النشطون. الإدارة: كل من له دور في admin_roles بحساب نشط.
create or replace function public.ev_audience_count(p_audience text[])
returns jsonb language sql stable security definer set search_path = public as $$
  with st as (
    select distinct student_id from public.v_active_students where status = 'active'
  ), tch as (
    select coalesce(t.user_id::text, 't:' || t.id) k from public.teachers t
    where t.is_active and 'teachers' = any(p_audience)
  ), adm as (
    select distinct r.user_id::text k from public.admin_roles r join public.users u on u.id = r.user_id
    where u.is_active and 'admin' = any(p_audience)
  )
  select jsonb_build_object(
    'students',  case when 'students' = any(p_audience) then (select count(*) from st) else 0 end,
    'guardians', case when 'guardians' = any(p_audience) then (
                   select count(distinct g.id) from public.guardians g
                   join public.guardian_student gs on gs.guardian_id = g.id
                   join st on st.student_id = gs.student_id
                   where g.is_active) else 0 end,
    'teachers',  (select count(*) from tch),
    'admin',     (select count(*) from adm),
    'staff',     (select count(*) from (select k from tch union select k from adm) x));
$$;

revoke execute on function public.ev_audience_count from public, anon;
grant  execute on function public.ev_audience_count to authenticated;

-- الأعداد تُحسب في الخادم، والحضور بالاسم مقصور على المعلمين والإدارة من فئة الحدث
create or replace function public.ev_audience_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  new.audience := coalesce(new.audience, '{}');
  if tg_op = 'INSERT' or new.audience is distinct from old.audience
     or new.stage is distinct from old.stage then
    new.audience_counts := case when cardinality(new.audience) = 0 then '{}'::jsonb
                                else public.ev_audience_count(new.audience) end;
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(new.audience_attended, '[]'::jsonb)) x
             where not ((x->>'kind' = 'teacher' and 'teachers' = any(new.audience))
                     or (x->>'kind' = 'admin'   and 'admin'    = any(new.audience)))) then
    raise exception 'الحضور بالاسم للمعلمين والإدارة من فئة الحدث فقط';
  end if;
  return new;
end;
$$;

drop trigger if exists ev_audience_guard on public.school_events;
create trigger ev_audience_guard before insert or update on public.school_events
  for each row execute function public.ev_audience_guard();

-- نهاية الجزء 1
