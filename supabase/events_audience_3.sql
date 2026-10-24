-- =====================================================================
-- حدث عام لصف معين (الجزء ٣ من ٣): نطاق الطلاب وأولياء الأمور.
--
-- audience_scope  {} = المدرسة كلها، أو {"grade": 1} = الصف الأول كله،
--                 أو {"grade": 1, "classes": [101, 102]} = فصول محددة منه.
--                 يخص فئتي الطلاب وأولياء الأمور، ويُهمل إن لم تكونا في الحدث.
-- يُنفَّذ بعد events_audience_1.sql و events_audience_2.sql، وتكرار تنفيذه آمن.
-- =====================================================================

alter table public.school_events add column if not exists audience_scope jsonb not null default '{}'::jsonb;

-- العدّ بالنطاق. الدالة القديمة بمعامل واحد تُحذف كي لا يلتبس الاستدعاء بها.
drop function if exists public.ev_audience_count(text[]);
create or replace function public.ev_audience_count(p_audience text[], p_scope jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  with st as (
    select distinct student_id from public.v_active_students
    where status = 'active'
      and (p_scope->>'grade' is null or grade = (p_scope->>'grade')::int)
      and (coalesce(jsonb_array_length(p_scope->'classes'), 0) = 0
           or class_no in (select x::int from jsonb_array_elements_text(p_scope->'classes') x))
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

revoke execute on function public.ev_audience_count(text[], jsonb) from public, anon;
grant  execute on function public.ev_audience_count(text[], jsonb) to authenticated;

-- الحارس نفسه مع النطاق: يُفرَّغ إن لم يكن في الحدث طلاب ولا أولياء أمور
create or replace function public.ev_audience_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  new.audience := coalesce(new.audience, '{}');
  new.audience_scope := case when new.audience && array['students', 'guardians']
                             then coalesce(new.audience_scope, '{}'::jsonb) else '{}'::jsonb end;
  if tg_op = 'INSERT' or new.audience is distinct from old.audience
     or new.audience_scope is distinct from old.audience_scope
     or new.stage is distinct from old.stage then
    new.audience_counts := case when cardinality(new.audience) = 0 then '{}'::jsonb
                                else public.ev_audience_count(new.audience, new.audience_scope) end;
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(new.audience_attended, '[]'::jsonb)) x
             where not ((x->>'kind' = 'teacher' and 'teachers' = any(new.audience))
                     or (x->>'kind' = 'admin'   and 'admin'    = any(new.audience)))) then
    raise exception 'الحضور بالاسم للمعلمين والإدارة من فئة الحدث فقط';
  end if;
  return new;
end;
$$;

-- نهاية الجزء 3
