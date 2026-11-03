-- شواهد الأداء الوظيفي للموظفين (4 من 7): العدّادات الآلية من عمل الموظف في البوابة في العام الدراسي،
-- (البند، العدد، آخرها) للموجه والوكيل ورائد النشاط. دالة داخلية بلا تحقق من المستدعي: تستدعيها
-- staff_perf_auto (الجزء 6) لصاحب الملف والمدير والدعم الفني، وملف الموظف الرقمي. يُنفَّذ بعد 1–3. تكرار التنفيذ آمن.
drop function if exists public.staff_perf_auto(uuid, text);
create or replace function public.staff_perf_auto_core(p_uid uuid, p_year text)
returns table (item_key text, cnt bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare y0 date; v_grades int[];
begin
  select coalesce(min(start_date), current_date - 365) into y0 from academic_calendar where academic_year = p_year;
  -- صفوف الموجه الطلابي من أدواره (counselor_1..3)
  select array_agg(substring(r.role_type::text from 'counselor_(\d)')::int) into v_grades
    from admin_roles r where r.user_id = p_uid and r.role_type::text ~ '^counselor_\d$';
  return query
  select x.k, x.n, x.l from (
    -- الموجه الطلابي
    select 'g03_01' k, count(*) n, max(s.created_at) l from guidance_sessions s where s.created_by = p_uid and s.kind = 'guardian' and s.session_date >= y0
    union all select 'g03_02', count(*), max(q.updated_at) from guidance_requests q
       where q.grade = any(coalesce(v_grades, '{}')) and (q.reply is not null or q.appointment_at is not null) and q.created_at >= y0
    union all select 'g04_01', count(*), max(f.counselor_at) from student_referrals f where f.counselor_id = p_uid and f.counselor_at >= y0
    union all select 'g04_02', count(*), max(f.created_at) from student_referrals f
       where f.counselor_id = p_uid and f.kind in ('missing', 'absence') and f.created_at >= y0
    union all select 'g05_01', count(*), max(p.created_at) from guidance_programs p where p.created_by = p_uid and p.kind = 'developmental' and p.created_at >= y0
    union all select 'g06_01', count(*), max(p.created_at) from guidance_programs p where p.created_by = p_uid and p.created_at >= y0
    union all select 'g06_03', count(*), max(p.done_date)::timestamptz from guidance_programs p where p.created_by = p_uid and p.status = 'done' and p.created_at >= y0
    union all select 'g07_01', count(*), max(c.opened_at) from guidance_cases c where c.opened_by = p_uid and c.opened_at >= y0
    union all select 'g07_04', count(*), max(c.closed_at) from guidance_cases c where c.opened_by = p_uid and c.closed_at is not null and c.opened_at >= y0
    union all select 'g08_01', count(*), max(p.created_at) from guidance_programs p where p.created_by = p_uid and p.kind in ('awareness', 'preventive') and p.created_at >= y0
    union all select 'g09_01', count(*), max(s.created_at) from guidance_sessions s where s.created_by = p_uid and s.kind = 'individual' and s.session_date >= y0
    union all select 'g09_02', count(*), max(s.created_at) from guidance_sessions s where s.created_by = p_uid and s.kind = 'group' and s.session_date >= y0
    union all select 'g12_01', count(*), max(p.created_at) from guidance_programs p where p.created_by = p_uid and p.kind = 'remedial' and p.created_at >= y0
    -- النشرات والاستبانات (الموجه والوكيل)
    union all select k2, count(*), max(o.sent_at) from outreach_items o, unnest(array['g08_02', 'd17_01']) k2
       where o.created_by = p_uid and o.sent_at is not null and o.created_at >= y0 group by k2
    -- الوكيل
    union all select 'd03_01', count(*), max(f.closed_at) from student_referrals f where f.deputy_id = p_uid and f.closed_at >= y0
    union all select 'd06_01', count(*), max(f.deputy_at) from student_referrals f where f.deputy_id = p_uid and f.deputy_at >= y0
    union all select 'd06_02', count(*), max(w.issued_at) from absence_warnings w where w.issued_by = p_uid and w.issued_on >= y0
    union all select 'd06_03', count(*), max(b.created_at) from behavior_forms b where b.issued_by = p_uid and b.created_at >= y0
    union all select 'd09_01', count(*), max(d.created_at) from form_documents d join form_templates t on t.id = d.template_id
       where t.key = 'teacher_support_visit' and d.created_by = p_uid and d.status not in ('draft', 'pending', 'rejected') and d.created_at >= y0
    union all select 'd16_01', count(*), max(e.approved_at) from school_events e where e.approved_by = p_uid and e.approved_at >= y0 and e.cancelled_at is null
    -- التصويت والاستطلاعات (الوكيل ورائد النشاط)
    union all select k3, count(*), max(p.created_at) from polls p, unnest(array['d17_02', 'a14_02']) k3
       where p.created_by = p_uid and p.cancelled_at is null and p.created_at >= y0 group by k3
    -- رائد النشاط
    union all select 'a12_02', count(*), max(e.approved_at) from school_events e
       where e.organizer_id = p_uid and e.stage = 'approved' and e.cancelled_at is null and e.event_date >= y0
    union all select 'a13_01', count(*), max(e.report_at) from school_events e where e.organizer_id = p_uid and e.report_at is not null and e.event_date >= y0
    union all select 'a14_01', count(*), max(c.created_at) from nom_calls c where c.owner_id = p_uid and c.published and c.created_at >= y0
    union all select 'a15_01', count(*), max(e.event_date)::timestamptz from event_participants ep join school_events e on e.id = ep.event_id
       where e.organizer_id = p_uid and e.cancelled_at is null and coalesce(ep.attended, true) and e.event_date >= y0
    union all select 'a15_02', count(*), max(ep.cert_issued_at) from event_participants ep join school_events e on e.id = ep.event_id
       where e.organizer_id = p_uid and ep.cert_issued_at is not null and e.event_date >= y0
  ) x where x.n > 0;
end; $$;
revoke execute on function public.staff_perf_auto_core(uuid, text) from public, anon, authenticated;

-- للتحقق: عناصر كل نموذج وبنوده
select e.track as "النموذج", count(distinct e.key) as "العناصر", count(i.key) as "البنود"
  from public.perf_elements e left join public.perf_items i on i.element_key = e.key
 where e.track in ('counselor', 'deputy', 'science', 'activity') group by e.track;
-- نهاية الجزء 4
