-- =====================================================================
-- الترشيحات (الجزء 4 من 4): أعمال صاحب الإعلان — جدولة المقابلات، وتقييمها، والقرار،
-- وإعلان النتائج (وإضافة المقبولين للفريق الكشفي إن رُبط الإعلان به). يُشغَّل بعد الجزء 3.
-- =====================================================================

-- ترشيح للمقابلة: مواعيد متتالية بالترتيب المرسَل، كل مقابلة p_minutes دقيقة
create or replace function public.nom_schedule(p_call uuid, p_apps uuid[], p_start timestamptz, p_minutes int, p_place text)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; i int;
begin
  if not public.nom_owns(p_call) then raise exception 'غير مصرّح'; end if;
  for i in 1 .. coalesce(array_length(p_apps, 1), 0) loop
    update nom_applications set stage = 'shortlisted', interview_place = nullif(p_place, ''), updated_at = now(),
           interview_at = p_start + make_interval(mins => (i - 1) * greatest(p_minutes, 1))
     where id = p_apps[i] and call_id = p_call and stage <> 'withdrawn';
    n := n + (case when found then 1 else 0 end);
  end loop;
  return n;
end $$;

create or replace function public.nom_score(p_app uuid, p_scores jsonb, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update nom_applications a set scores = coalesce(p_scores, '{}'), interview_note = nullif(p_note, ''), updated_at = now()
   where a.id = p_app and public.nom_owns(a.call_id);
  if not found then raise exception 'غير مصرّح'; end if;
end $$;

-- القرار: مقبول / احتياط / غير مقبول، أو إعادة إلى «مرشح» / «مقدَّم»
create or replace function public.nom_set_stage(p_apps uuid[], p_stage text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_stage not in ('applied', 'shortlisted', 'accepted', 'reserve', 'rejected') then raise exception 'حالة غير معروفة'; end if;
  update nom_applications a set stage = p_stage, updated_at = now()
   where a.id = any(p_apps) and a.stage <> 'withdrawn' and public.nom_owns(a.call_id);
  get diagnostics n = row_count;
  return n;
end $$;

-- إعلان النتائج: تظهر لكل طالب ولولي أمره نتيجته وحده
create or replace function public.nom_publish(p_call uuid) returns int
language plpgsql security definer set search_path = public as $$
declare c nom_calls; n int := 0;
begin
  if not public.nom_owns(p_call) then raise exception 'غير مصرّح'; end if;
  update nom_calls set results_at = coalesce(results_at, now()) where id = p_call returning * into c;
  if c.link_scouts and to_regclass('public.scout_members') is not null then
    execute 'insert into scout_members (student_id, added_by, added_by_name)
             select a.student_id, auth.uid(), $2 from nom_applications a
              where a.call_id = $1 and a.stage = ''accepted'' on conflict (student_id) do nothing'
      using p_call, 'الترشيحات: ' || c.title;
    get diagnostics n = row_count;
  end if;
  return n;
end $$;

revoke all on function public.nom_schedule(uuid, uuid[], timestamptz, int, text), public.nom_score(uuid, jsonb, text),
  public.nom_set_stage(uuid[], text), public.nom_publish(uuid) from public, anon;
grant execute on function public.nom_schedule(uuid, uuid[], timestamptz, int, text), public.nom_score(uuid, jsonb, text),
  public.nom_set_stage(uuid[], text), public.nom_publish(uuid) to authenticated;
-- نهاية الجزء 4
