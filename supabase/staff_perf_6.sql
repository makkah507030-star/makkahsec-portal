-- شواهد الأداء الوظيفي للموظفين (6 من 7): بنود الوكلاء الخاصة بعمل كل وكيل في البوابة، وتفاصيلها.
-- شؤون الطلاب: أعذار الغياب والمنقطعون وبلاغات الكشافة. الشؤون التعليمية: خطط التحسين ومجتمعات التعلم والتطوير
-- المهني والزيارات التبادلية والملفات الرقمية ورصد نور ولجنة التحصيل. الشؤون المدرسية: بلاغات الصيانة. وللجميع:
-- الثقافة المدرسية والنماذج الرسمية. ثم staff_perf_auto للواجهة. يُنفَّذ بعد الأجزاء 1–5. تكرار التنفيذ آمن.
create or replace function public.deputy_perf_auto_core(p_uid uuid, y0 date)
returns table (item_key text, cnt bigint, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  with me as (select full_name nm from users where id = p_uid)
  select x.k, x.n, x.l from (
    select 'd06_04' k, count(*) n, max(a.decided_at) l from absence_excuses a, me
     where a.decided_by_name = me.nm and a.decided_by_role = 'deputy_students' and a.status <> 'pending' and a.decided_at >= y0
    union all select 'd06_05', count(*), max(s.decided_at) from student_dropouts s, me where s.decided_by_name = me.nm and s.decided_at >= y0
    union all select 'd18_03', count(*), max(r.closed_at) from scout_reports r, me where r.closed_by_name = me.nm and r.closed_at >= y0
    union all select 'd07_03', count(*), max(coalesce(t.resolved_at, t.updated_at)) from maint_tickets t, me
     where t.handler_name = me.nm and t.status in ('resolved', 'external') and t.created_at >= y0
    union all select 'd09_03', count(*), max(g.updated_at) from improvement_goals g where g.owner_user_id = p_uid and g.created_at >= y0
    union all select 'd10_03', count(*), max(l) from (
       select decided_at l from plc_sessions where decided_by = p_uid and status = 'approved' and decided_at >= y0
       union all select decided_at from pd_reports where decided_by = p_uid and status = 'approved' and decided_at >= y0) z
    union all select 'd11_03', count(*), max(o.written_at) from dfile_opinions o where o.author_user_id = p_uid and o.written_at >= y0
    union all select 'd11_04', count(*), max(v.decided_at) from exchange_visits v where v.decided_by = p_uid and v.status = 'approved' and v.decided_at >= y0
    union all select 'd12_03', count(*), max(m.updated_at) from noor_grade_marks m where m.updated_by = p_uid and m.updated_at >= y0
    union all select 'd12_04', count(*), max(a.held_on)::timestamptz from ach_meetings a, me where a.created_by_name = me.nm and a.held_on >= y0
    union all select 'd13_03', count(*), max(c.held_on)::timestamptz from cult_meetings c, me where c.created_by_name = me.nm and c.held_on >= y0
    union all select 'd15_03', count(*), max(d.created_at) from form_documents d join form_templates t on t.id = d.template_id
     where t.key <> 'teacher_support_visit' and d.created_by = p_uid and d.status not in ('draft', 'pending', 'rejected') and d.created_at >= y0
  ) x where x.n > 0;
$$;
revoke execute on function public.deputy_perf_auto_core(uuid, date) from public, anon, authenticated;

-- العدّادات للواجهة: لصاحب الملف نفسه، ولمدير المدرسة والدعم الفني
create or replace function public.staff_perf_auto(p_uid uuid, p_year text)
returns table (teacher_user_id uuid, item_key text, cnt bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare y0 date;
begin
  if not (p_uid = auth.uid() or public.has_admin_role(array['principal', 'tech_support'])) then return; end if;
  select coalesce(min(start_date), current_date - 365) into y0 from academic_calendar where academic_year = p_year;
  return query select p_uid, c.item_key, c.cnt, c.last_at from public.staff_perf_auto_core(p_uid, p_year) c
    union all select p_uid, d.item_key, d.cnt, d.last_at from public.deputy_perf_auto_core(p_uid, y0) d;
end; $$;
revoke execute on function public.staff_perf_auto(uuid, text) from public, anon;
grant execute on function public.staff_perf_auto(uuid, text) to authenticated;

-- تفاصيل البنود السابقة («عرض الشواهد»)؛ تستدعيها staff_perf_details (الجزء 5) بعد تحققها
create or replace function public.deputy_perf_details(p_uid uuid, y0 date, p_item text)
returns table (r_title text, r_detail text, r_at timestamptz)
language sql stable security definer set search_path = public as $$
  with me as (select full_name nm from users where id = p_uid)
  select * from (
    select 'عذر غياب' t, case a.status when 'accepted' then 'قُبل' else 'رُفض' end || ' · ' || cardinality(a.dates) || ' يوم' d, a.decided_at w
      from absence_excuses a, me where p_item = 'd06_04' and a.decided_by_name = me.nm and a.decided_by_role = 'deputy_students'
       and a.status <> 'pending' and a.decided_at >= y0
    union all select 'بلاغ انقطاع', case s.status when 'withdrawn' then 'طُوي القيد' when 'returned' then 'عاد الطالب' else 'رُدّ البلاغ' end, s.decided_at
      from student_dropouts s, me where p_item = 'd06_05' and s.decided_by_name = me.nm and s.decided_at >= y0
    union all select r.title, 'بلاغ الفريق الكشفي', r.closed_at from scout_reports r, me
     where p_item = 'd18_03' and r.closed_by_name = me.nm and r.closed_at >= y0
    union all select t.category, coalesce(t.place, '') || case when t.status = 'external' then ' · صيانة خارجية' else ' · عولج' end,
           coalesce(t.resolved_at, t.updated_at) from maint_tickets t, me
     where p_item = 'd07_03' and t.handler_name = me.nm and t.status in ('resolved', 'external') and t.created_at >= y0
    union all select 'خطة تحسين: ' || u.full_name, left(g.recommendation, 90), g.updated_at from improvement_goals g join users u on u.id = g.teacher_user_id
     where p_item = 'd09_03' and g.owner_user_id = p_uid and g.created_at >= y0
    union all select 'لقاء مجتمع تعلم ' || coalesce(serial, ''), coalesce(head_name, ''), decided_at from plc_sessions
     where p_item = 'd10_03' and decided_by = p_uid and status = 'approved' and decided_at >= y0
    union all select 'تقرير تطوير مهني ' || coalesce(serial, ''), coalesce(owner_name, ''), decided_at from pd_reports
     where p_item = 'd10_03' and decided_by = p_uid and status = 'approved' and decided_at >= y0
    union all select 'رأي في ملف ' || u.full_name, left(o.body, 90), o.written_at from dfile_opinions o join users u on u.id = o.teacher_user_id
     where p_item = 'd11_03' and o.author_user_id = p_uid and o.written_at >= y0
    union all select 'زيارة تبادلية ' || coalesce(v.serial, ''), coalesce(v.visitor_name, '') || ' ← ' || coalesce(v.host_name, ''), v.decided_at
      from exchange_visits v where p_item = 'd11_04' and v.decided_by = p_uid and v.status = 'approved' and v.decided_at >= y0
    union all select 'متابعة رصد الدرجات', case m.status when 'done' then 'اكتمل الرصد' else 'رصد جزئي' end, m.updated_at
      from noor_grade_marks m where p_item = 'd12_03' and m.updated_by = p_uid and m.updated_at >= y0
    union all select a.title, 'اجتماع لجنة التحصيل', a.held_on::timestamptz from ach_meetings a, me
     where p_item = 'd12_04' and a.created_by_name = me.nm and a.held_on >= y0
    union all select coalesce(c.title, 'لقاء'), coalesce(c.attendees || ' حاضرًا', ''), c.held_on::timestamptz from cult_meetings c, me
     where p_item = 'd13_03' and c.created_by_name = me.nm and c.held_on >= y0
    union all select d.title, coalesce(d.recipient, ''), d.created_at from form_documents d join form_templates t on t.id = d.template_id
     where p_item = 'd15_03' and t.key <> 'teacher_support_visit' and d.created_by = p_uid
       and d.status not in ('draft', 'pending', 'rejected') and d.created_at >= y0
  ) x order by 3 desc nulls last;
$$;
revoke execute on function public.deputy_perf_details(uuid, date, text) from public, anon, authenticated;
-- نهاية الجزء 6
