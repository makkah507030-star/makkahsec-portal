-- =====================================================================
-- بنك الأنشطة (الجزء 3): «من مدرستي» — معلومات عامة عن المدرسة تُولَّد منها أسئلة
-- تُدمج في ألعاب الحقيبة (مسابقة الفرق وحروف). معلومات عامة فقط: المعلمون ومواد
-- تدريسهم، وأسماء الإدارة ومناصبها، وعدد الفصول، وأوقات الحصص، وأجهزة المعمل، والأخبار
-- المنشورة، والمناسبات المعتمدة. لا شيء عن الطلاب، ولا بيانات شخصية للمعلمين.
-- يُنفَّذ بعد الجزأين 1 و2. تكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.act_school_facts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_year text := (select value from settings where key = 'active_year');
  v_season text := coalesce((select value from settings where key = 'active_season'), 'winter');
  v jsonb;
  v_lab bigint;
begin
  if auth.uid() is null then raise exception 'غير مصرّح'; end if;
  if to_regclass('public.lab_devices') is not null then execute 'select count(*) from public.lab_devices' into v_lab; end if;
  select jsonb_build_object(
    'teachers', (select coalesce(jsonb_agg(jsonb_build_object('name', x.full_name, 'subjects', x.subs)), '[]')
       from (select t.full_name, array_agg(distinct sub.name) subs
               from schedule s join teachers t on t.id = s.teacher_id
               join subjects sub on sub.id = s.subject_id
              where s.academic_year = coalesce(v_year, s.academic_year) and coalesce(t.is_active, true)
              group by t.id, t.full_name) x),
    'admins', (select coalesce(jsonb_agg(jsonb_build_object('name', u.full_name, 'role', r.role_type::text)), '[]')
       from admin_roles r join users u on u.id = r.user_id
      where r.role_type::text in ('principal', 'deputy_academic', 'deputy_students', 'deputy_school', 'activity_leader')
        and u.is_active and u.full_name is not null),
    'classes', (select coalesce(jsonb_object_agg(g, n), '{}') from
       (select grade g, count(*) n from classes where is_active group by grade) c),
    'periods', (select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'no', period_no, 'label', label,
        'start', to_char(start_time, 'HH24:MI'), 'end', to_char(end_time, 'HH24:MI')) order by sort_order), '[]')
       from period_times where season = v_season),
    'lab_devices', v_lab,
    'news', (select coalesce(jsonb_agg(title), '[]') from
       (select title from news where is_published order by published_at desc nulls last limit 5) n),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('title', title, 'date', event_date) order by event_date), '[]')
       from school_events e where e.stage <> 'draft' and (to_jsonb(e) ->> 'cancelled_at') is null
        and e.event_date between current_date - 60 and current_date + 60)
  ) into v;
  return v;
end $$;

revoke all on function public.act_school_facts() from public, anon;
grant execute on function public.act_school_facts() to authenticated;

-- نهاية الجزء 3
