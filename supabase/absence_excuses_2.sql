-- =====================================================================
-- أعذار الغياب (الجزء 2 من 2): قرار وكيل شؤون الطلاب. يُشغَّل بعد الجزء 1. تكرار التنفيذ آمن.
-- • القبول: الأيام المعتمدة يصير غيابها الرسمي «غائب بعذر» (قرار يدوي لا يُستبدل بإعادة الاعتماد)،
--   ويُسجَّل العذر في excused_absences لما لم يُعتمد بعد من أيامه.
-- • الرفض: بملاحظة. وفي الحالين يصل صاحب العذر إشعار.
-- =====================================================================

create or replace function public.absence_excuse_decide(p_id uuid, p_accept boolean, p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare e absence_excuses; who text; n int := 0; nid uuid; yr text;
begin
  if not public.excuse_manager() then raise exception 'غير مصرّح'; end if;
  select * into e from absence_excuses where id = p_id for update;
  if e.id is null then raise exception 'العذر غير موجود'; end if;
  if e.status <> 'pending' then raise exception 'اتُّخذ القرار في هذا العذر'; end if;
  if not p_accept and coalesce(trim(p_note), '') = '' then raise exception 'اكتب سبب عدم القبول'; end if;
  who := (select full_name from users where id = auth.uid());

  update absence_excuses set status = case when p_accept then 'accepted' else 'rejected' end,
         decision_note = nullif(trim(p_note), ''), decided_by_name = who, decided_at = now()
   where id = p_id;

  if p_accept then
    update official_day_marks m
       set status = 'excused', manual = true, edited_by_name = who, edited_at = now(),
           note = left('عذر مقبول' || coalesce(': ' || nullif(trim(e.reason), ''), ''), 200)
     where m.student_id = e.student_id and m.attend_date = any(e.dates) and m.status = 'absent';
    get diagnostics n = row_count;
    select value into yr from settings where key = 'active_year';
    insert into excused_absences (student_id, date_from, date_to, excuse, reason, created_by, academic_year)
    select e.student_id, d, d, (case e.kind when 'medical' then 'medical' else 'other' end)::excuse_type,
           left(coalesce(nullif(trim(e.reason), ''), 'عذر مقبول من البوابة'), 200), auth.uid(), coalesce(yr, '')
      from unnest(e.dates) d
     where not exists (select 1 from excused_absences x where x.student_id = e.student_id and d between x.date_from and x.date_to);
  end if;

  nid := public.send_notification(case when p_accept then 'قُبل عذر الغياب' else 'لم يُقبل عذر الغياب' end,
    (select full_name from students where id = e.student_id) || ' · '
      || array_to_string(array(select to_char(d, 'YYYY/MM/DD') from unnest(e.dates) d order by d), '، ')
      || coalesce(' · ' || nullif(trim(p_note), ''), ''),
    'general', '/', null, array[e.requested_by], null, null, true);
  begin perform public.push_notification(nid); exception when others then null; end;
  return n;
end $$;

revoke all on function public.absence_excuse_decide(uuid, boolean, text) from public, anon;
grant execute on function public.absence_excuse_decide(uuid, boolean, text) to authenticated;
-- نهاية الجزء 2
