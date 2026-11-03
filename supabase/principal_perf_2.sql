-- شواهد الأداء الوظيفي لمدير المدرسة (2 من 3): العدّادات الآلية من عمله في البوابة، ثم staff_perf_auto
-- للواجهة بالمسارات كلها. ما يُحفظ بالاسم (الصيانة واللجان والثقافة) يُطابق باسم المدير في حسابه.
-- يُنفَّذ بعد الجزء 1. تكرار التنفيذ آمن.
create or replace function public.principal_perf_auto_core(p_uid uuid, y0 date)
returns table (item_key text, cnt bigint, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  with me as (select full_name nm from users where id = p_uid)
  select x.k, x.n, x.l from (
    select 'm03_01' k, count(*) n, max(o.created_at) l from notifications o where o.created_by = p_uid and not o.is_auto and o.created_at >= y0
    union all select 'm07_02', count(*), max(coalesce(t.resolved_at, t.updated_at)) from maint_tickets t, me
     where t.handler_name = me.nm and t.status in ('resolved', 'external') and t.created_at >= y0
    union all select 'm09_01', count(*), max(d.created_at) from form_documents d join form_templates t on t.id = d.template_id
     where t.key = 'teacher_support_visit' and d.created_by = p_uid and d.status not in ('draft', 'pending', 'rejected') and d.created_at >= y0
    union all select 'm09_02', count(*), max(g.updated_at) from improvement_goals g where g.owner_user_id = p_uid and g.created_at >= y0
    union all select 'm10_01', count(*), max(l) from me, lateral (
       select coalesce(principal_at, decided_at) l from plc_sessions where (principal_name = me.nm or decided_by = p_uid) and status = 'approved' and created_at >= y0
       union all select coalesce(principal_at, decided_at) from pd_reports where (principal_name = me.nm or decided_by = p_uid) and status = 'approved' and created_at >= y0
       union all select coalesce(principal_at, decided_at) from exchange_visits where (principal_name = me.nm or decided_by = p_uid) and status = 'approved' and created_at >= y0) z
    union all select 'm11_01', count(*), max(r.sent_at) from perf_reviews r where r.created_by = p_uid and r.sent_at >= y0
    union all select 'm11_02', count(*), max(o.written_at) from dfile_opinions o where o.author_user_id = p_uid and o.written_at >= y0
    union all select 'm12_02', count(*), max(a.held_on)::timestamptz from ach_meetings a, me where a.created_by_name = me.nm and a.held_on >= y0
    union all select 'm13_01', count(*), max(a.created_at) from acc_reports a, me where a.created_by_name = me.nm and a.created_at >= y0
    union all select 'm13_02', count(*), max(a.held_on)::timestamptz from acc_meetings a, me where a.created_by_name = me.nm and a.held_on >= y0
    union all select 'm14_02', count(*), max(a.approved_at) from acc_plans a, me where a.approved_by_name = me.nm and a.approved_at >= y0
    union all select 'm15_01', count(*), max(c.sent_at) from circulars c where c.created_by = p_uid and c.sent_at >= y0
    union all select 'm15_02', count(*), max(d.approved_at) from form_documents d where d.approved_by = p_uid and d.approved_at >= y0
    union all select 'm16_01', count(*), max(e.approved_at) from school_events e where e.approved_by = p_uid and e.approved_at >= y0 and e.cancelled_at is null
    union all select 'm17_01', count(*), max(o.sent_at) from outreach_items o where o.created_by = p_uid and o.sent_at >= y0
    union all select 'm17_02', count(*), max(p.created_at) from polls p where p.created_by = p_uid and p.cancelled_at is null and p.created_at >= y0
    union all select 'm17_03', count(*), max(w.published_at) from news w where w.created_by = p_uid and w.published_at >= y0
    union all select 'm18_02', count(*), max(c.held_on)::timestamptz from cult_meetings c, me where c.created_by_name = me.nm and c.held_on >= y0
  ) x where x.n > 0;
$$;
revoke execute on function public.principal_perf_auto_core(uuid, date) from public, anon, authenticated;

-- العدّادات للواجهة (تحل محل نسخة staff_perf_6.sql): لصاحب الملف نفسه، ولمدير المدرسة والدعم الفني
create or replace function public.staff_perf_auto(p_uid uuid, p_year text)
returns table (teacher_user_id uuid, item_key text, cnt bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare y0 date;
begin
  if not (p_uid = auth.uid() or public.has_admin_role(array['principal', 'tech_support'])) then return; end if;
  select coalesce(min(start_date), current_date - 365) into y0 from academic_calendar where academic_year = p_year;
  return query select p_uid, c.item_key, c.cnt, c.last_at from public.staff_perf_auto_core(p_uid, p_year) c
    union all select p_uid, d.item_key, d.cnt, d.last_at from public.deputy_perf_auto_core(p_uid, y0) d
    union all select p_uid, m.item_key, m.cnt, m.last_at from public.principal_perf_auto_core(p_uid, y0) m;
end; $$;
revoke execute on function public.staff_perf_auto(uuid, text) from public, anon;
grant execute on function public.staff_perf_auto(uuid, text) to authenticated;
-- نهاية الجزء 2
