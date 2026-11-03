-- شواهد الأداء الوظيفي للموظفين (5 من 7): تفاصيل كل بند آلي («عرض الشواهد») للموجه والوكيل ورائد النشاط،
-- بصيغة perf_auto_details نفسها (العنوان، التفصيل، التاريخ). يُنفَّذ بعد الجزء 4، ويكمّله الجزء 6. تكرار التنفيذ آمن.
create or replace function public.staff_perf_details(p_uid uuid, p_year text, p_item text)
returns table (r_title text, r_detail text, r_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare y0 date; v_grades int[];
  pk jsonb := '{"awareness":"توعوي","preventive":"وقائي","developmental":"نمائي","remedial":"علاجي"}';
  sk jsonb := '{"individual":"فردية","group":"جمعية","guardian":"مع ولي الأمر","teacher":"مع المعلم"}';
begin
  if not (p_uid = auth.uid() or public.has_admin_role(array['principal', 'tech_support'])) then return; end if;
  select coalesce(min(start_date), current_date - 365) into y0 from academic_calendar where academic_year = p_year;
  select array_agg(substring(r.role_type::text from 'counselor_(\d)')::int) into v_grades
    from admin_roles r where r.user_id = p_uid and r.role_type::text ~ '^counselor_\d$';

  if p_item in ('g05_01', 'g06_01', 'g06_03', 'g08_01', 'g12_01') then
    return query select p.title, coalesce(pk ->> p.kind, p.kind) || case when p.status = 'done' then ' · نُفّذ' else ' · مخطط' end
             || coalesce(' · ' || p.beneficiaries || ' مستفيد', ''), coalesce(p.done_date::timestamptz, p.created_at)
      from guidance_programs p where p.created_by = p_uid and p.created_at >= y0
       and (p_item in ('g06_01') or (p_item = 'g06_03' and p.status = 'done') or (p_item = 'g05_01' and p.kind = 'developmental')
            or (p_item = 'g08_01' and p.kind in ('awareness', 'preventive')) or (p_item = 'g12_01' and p.kind = 'remedial'))
     order by 3 desc;
  elsif p_item in ('g03_01', 'g09_01', 'g09_02') then
    return query select 'جلسة ' || coalesce(sk ->> s.kind, s.kind), coalesce(c.title, 'حالة') || ' · الصف ' || c.grade, s.session_date::timestamptz
      from guidance_sessions s join guidance_cases c on c.id = s.case_id
     where s.created_by = p_uid and s.session_date >= y0
       and s.kind = case p_item when 'g03_01' then 'guardian' when 'g09_01' then 'individual' else 'group' end
     order by 3 desc;
  elsif p_item in ('g07_01', 'g07_04') then
    return query select c.title, 'الصف ' || c.grade || case when c.closed_at is not null then ' · أُغلقت' else ' · مفتوحة' end,
           coalesce(c.closed_at, c.opened_at)
      from guidance_cases c where c.opened_by = p_uid and c.opened_at >= y0 and (p_item = 'g07_01' or c.closed_at is not null) order by 3 desc;
  elsif p_item = 'g03_02' then
    return query select 'طلب تواصل مع الموجه', 'الصف ' || q.grade || coalesce(' · ' || q.requester, ''), q.updated_at
      from guidance_requests q where q.grade = any(coalesce(v_grades, '{}')) and (q.reply is not null or q.appointment_at is not null)
       and q.created_at >= y0 order by 3 desc;
  elsif p_item in ('g04_01', 'g04_02', 'd03_01', 'd06_01') then
    return query select 'إحالة ' || f.serial, coalesce(f.class_label, '') || coalesce(' · ' || left(f.reason, 60), ''),
           coalesce(f.counselor_at, f.deputy_at, f.created_at)
      from student_referrals f
     where f.created_at >= y0 and case p_item
       when 'g04_01' then f.counselor_id = p_uid and f.counselor_at is not null
       when 'g04_02' then f.counselor_id = p_uid and f.kind in ('missing', 'absence')
       when 'd03_01' then f.deputy_id = p_uid and f.closed_at is not null
       else f.deputy_id = p_uid and f.deputy_at is not null end
     order by 3 desc;
  elsif p_item in ('g08_02', 'd17_01') then
    return query select o.title, 'نشرة أو استبانة', o.sent_at from outreach_items o
     where o.created_by = p_uid and o.sent_at is not null and o.created_at >= y0 order by 3 desc;
  elsif p_item in ('d17_02', 'a14_02') then
    return query select p.title, 'تصويت أو استطلاع', p.created_at from polls p
     where p.created_by = p_uid and p.cancelled_at is null and p.created_at >= y0 order by 3 desc;
  elsif p_item = 'd06_02' then
    return query select 'إنذار غياب', 'الأيام ' || w.days_count, w.issued_on::timestamptz from absence_warnings w
     where w.issued_by = p_uid and w.issued_on >= y0 order by 3 desc;
  elsif p_item = 'd06_03' then
    return query select coalesce(b.violation_type, 'نموذج سلوكي'), coalesce(b.class_label, ''), b.created_at from behavior_forms b
     where b.issued_by = p_uid and b.created_at >= y0 order by 3 desc;
  elsif p_item = 'd09_01' then
    return query select d.title, coalesce(d.recipient, ''), d.created_at from form_documents d join form_templates t on t.id = d.template_id
     where t.key = 'teacher_support_visit' and d.created_by = p_uid and d.status not in ('draft', 'pending', 'rejected') and d.created_at >= y0
     order by 3 desc;
  elsif p_item in ('d16_01', 'a12_02', 'a13_01') then
    return query select e.title, coalesce(e.category, '') || coalesce(' · ' || e.venue, ''), e.event_date::timestamptz from school_events e
     where e.cancelled_at is null and e.event_date >= y0 and case p_item
       when 'd16_01' then e.approved_by = p_uid when 'a12_02' then e.organizer_id = p_uid and e.stage = 'approved'
       else e.organizer_id = p_uid and e.report_at is not null end
     order by 3 desc;
  elsif p_item = 'a14_01' then
    return query select c.title, coalesce(c.unit, ''), c.created_at from nom_calls c
     where c.owner_id = p_uid and c.published and c.created_at >= y0 order by 3 desc;
  elsif p_item in ('a15_01', 'a15_02') then
    return query select e.title, count(*) || case when p_item = 'a15_02' then ' شهادة' else ' مشارك' end, e.event_date::timestamptz
      from event_participants ep join school_events e on e.id = ep.event_id
     where e.organizer_id = p_uid and e.cancelled_at is null and e.event_date >= y0
       and (p_item = 'a15_01' and coalesce(ep.attended, true) or p_item = 'a15_02' and ep.cert_issued_at is not null)
     group by e.id, e.title, e.event_date order by 3 desc;
  else   -- بنود الوكلاء الخاصة بكل وكيل (الجزء 6)
    return query select * from public.deputy_perf_details(p_uid, y0, p_item);
  end if;
end; $$;
revoke execute on function public.staff_perf_details(uuid, text, text) from public, anon;
grant execute on function public.staff_perf_details(uuid, text, text) to authenticated;
-- نهاية الجزء 5
