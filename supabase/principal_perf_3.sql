-- شواهد الأداء الوظيفي لمدير المدرسة (3 من 3): تفاصيل كل بند آلي («عرض الشواهد»)، وملفه الرقمي
-- بنظام ملف الموظف (staff_dfiles). يُنفَّذ بعد الجزء 2 وبعد staff_dfile_1..2.sql. تكرار التنفيذ آمن.
create or replace function public.principal_perf_details(p_uid uuid, p_year text, p_item text)
returns table (r_title text, r_detail text, r_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare y0 date; nm text := (select full_name from users where id = p_uid);
begin
  if not (p_uid = auth.uid() or public.has_admin_role(array['principal', 'tech_support'])) then return; end if;
  select coalesce(min(start_date), current_date - 365) into y0 from academic_calendar where academic_year = p_year;
  return query select * from (
    select o.title t, coalesce(o.sender_name, '') d, o.created_at w from notifications o
     where p_item = 'm03_01' and o.created_by = p_uid and not o.is_auto and o.created_at >= y0
    union all select x.category, coalesce(x.place, '') || case when x.status = 'external' then ' · صيانة خارجية' else ' · عولج' end,
           coalesce(x.resolved_at, x.updated_at) from maint_tickets x
     where p_item = 'm07_02' and x.handler_name = nm and x.status in ('resolved', 'external') and x.created_at >= y0
    union all select d.title, coalesce(d.recipient, ''), d.created_at from form_documents d join form_templates f on f.id = d.template_id
     where p_item in ('m09_01', 'm15_02') and d.created_at >= y0 and case p_item
       when 'm09_01' then f.key = 'teacher_support_visit' and d.created_by = p_uid and d.status not in ('draft', 'pending', 'rejected')
       else d.approved_by = p_uid end
    union all select 'خطة تحسين: ' || u.full_name, left(g.recommendation, 90), g.updated_at from improvement_goals g join users u on u.id = g.teacher_user_id
     where p_item = 'm09_02' and g.owner_user_id = p_uid and g.created_at >= y0
    union all select 'لقاء مجتمع تعلم ' || coalesce(serial, ''), coalesce(head_name, ''), coalesce(principal_at, decided_at) from plc_sessions
     where p_item = 'm10_01' and (principal_name = nm or decided_by = p_uid) and status = 'approved' and created_at >= y0
    union all select 'تقرير تطوير مهني ' || coalesce(serial, ''), coalesce(owner_name, ''), coalesce(principal_at, decided_at) from pd_reports
     where p_item = 'm10_01' and (principal_name = nm or decided_by = p_uid) and status = 'approved' and created_at >= y0
    union all select 'زيارة تبادلية ' || coalesce(serial, ''), coalesce(visitor_name, '') || ' ← ' || coalesce(host_name, ''), coalesce(principal_at, decided_at)
      from exchange_visits where p_item = 'm10_01' and (principal_name = nm or decided_by = p_uid) and status = 'approved' and created_at >= y0
    union all select u.full_name, case r.stage when 'mid' then 'المراجعة النصف سنوية' else 'التقييم النهائي' end
           || case when r.ack_at is not null then ' · أقرّ بالاطلاع' else '' end, r.sent_at
      from perf_reviews r join users u on u.id = r.teacher_user_id where p_item = 'm11_01' and r.created_by = p_uid and r.sent_at >= y0
    union all select 'رأي في ملف ' || u.full_name, left(o.body, 90), o.written_at from dfile_opinions o join users u on u.id = o.teacher_user_id
     where p_item = 'm11_02' and o.author_user_id = p_uid and o.written_at >= y0
    union all select a.title, 'اجتماع لجنة التحصيل', a.held_on::timestamptz from ach_meetings a where p_item = 'm12_02' and a.created_by_name = nm and a.held_on >= y0
    union all select a.title, 'تقرير', a.created_at from acc_reports a where p_item = 'm13_01' and a.created_by_name = nm and a.created_at >= y0
    union all select a.title, 'اجتماع فريق التميز', a.held_on::timestamptz from acc_meetings a where p_item = 'm13_02' and a.created_by_name = nm and a.held_on >= y0
    union all select a.title, 'خطة معتمدة', a.approved_at from acc_plans a where p_item = 'm14_02' and a.approved_by_name = nm and a.approved_at >= y0
    union all select c.subject, case c.direction when 'internal' then 'تعميم داخلي' else 'تعميم وارد' end, c.sent_at from circulars c
     where p_item = 'm15_01' and c.created_by = p_uid and c.sent_at >= y0
    union all select e.title, coalesce(e.category, ''), e.event_date::timestamptz from school_events e
     where p_item = 'm16_01' and e.approved_by = p_uid and e.approved_at >= y0 and e.cancelled_at is null
    union all select o.title, 'نشرة أو استبانة', o.sent_at from outreach_items o where p_item = 'm17_01' and o.created_by = p_uid and o.sent_at >= y0
    union all select p.title, 'تصويت أو استطلاع', p.created_at from polls p where p_item = 'm17_02' and p.created_by = p_uid and p.cancelled_at is null and p.created_at >= y0
    union all select w.title, 'خبر منشور', w.published_at from news w where p_item = 'm17_03' and w.created_by = p_uid and w.published_at >= y0
    union all select coalesce(c.title, 'لقاء'), coalesce(c.attendees || ' حاضرًا', ''), c.held_on::timestamptz from cult_meetings c
     where p_item = 'm18_02' and c.created_by_name = nm and c.held_on >= y0
  ) q order by 3 desc nulls last;
end; $$;
revoke execute on function public.principal_perf_details(uuid, text, text) from public, anon;
grant execute on function public.principal_perf_details(uuid, text, text) to authenticated;

-- الملف الرقمي: مدير المدرسة وظيفة رابعة في staff_dfiles (رمز MW- نفسه)
alter table public.staff_dfiles drop constraint if exists staff_dfiles_track_check;
alter table public.staff_dfiles add constraint staff_dfiles_track_check check (track in ('deputy', 'counselor', 'science', 'principal'));
create or replace function public.staff_dfile_track(p_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when bool_or(role_type::text = 'principal') then 'principal'
              when bool_or(role_type::text like 'deputy\_%') then 'deputy'
              when bool_or(role_type::text ~ '^counselor_\d$') then 'counselor'
              when bool_or(role_type::text ~ '^science_labs') then 'science' end
    from public.admin_roles where user_id = p_uid;
$$;
-- نهاية الجزء 3
