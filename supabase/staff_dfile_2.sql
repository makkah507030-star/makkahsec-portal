-- الملف الرقمي للموظفين (2 من 2): بيانات الملف للزائر برمزه دون دخول، كما lab_dfile_public لمحضر المعمل.
-- عمله الآلي في البوابة (بنود نموذجه وأعدادها)، وتغطية عناصر الأداء، والشواهد المرفوعة بعناوينها فقط.
-- بنود الوكيل بحسب مجاله (perf_items.roles). لا أسماء طلاب. يُنفَّذ بعد الجزء 1 وprincipal_perf_1..3.sql وsci_lab_1..6.sql. تكرار التنفيذ آمن.

create or replace function public.staff_dfile_public(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f public.staff_dfiles; y text := (select value from public.settings where key = 'active_year');
  u uuid; y0 date; rs text[]; au jsonb;
begin
  select d.* into f from public.staff_dfiles d join public.users x on x.id = d.user_id
   where d.code = upper(trim(p_code)) and d.disabled_at is null and x.is_active;
  if not found then return jsonb_build_object('status', 'off'); end if;
  u := f.user_id;
  select coalesce(min(start_date), current_date - 365) into y0 from academic_calendar where academic_year = y;
  select coalesce(array_agg(role_type::text), '{}') into rs from admin_roles where user_id = u;
  -- العدّادات الآلية: الموجه من عمله، والوكيل من عمله ومجاله، والمدير (principal_perf_2.sql)، ومحضر العلوم من مختبره (sci_lab_6.sql)
  select coalesce(jsonb_object_agg(a.item_key, jsonb_build_object('n', a.cnt, 'last', a.last_at)), '{}') into au from (
    select c.item_key, c.cnt, c.last_at from staff_perf_auto_core(u, y) c where f.track <> 'science'
    union all select d.item_key, d.cnt, d.last_at from deputy_perf_auto_core(u, y0) d where f.track = 'deputy'
    union all select m.item_key, m.cnt, m.last_at from principal_perf_auto_core(u, y0) m where f.track = 'principal'
    union all select x.item_key, x.cnt, x.last_at from sci_perf_auto_core(u, y0) x where f.track = 'science') a
   where exists (select 1 from perf_items i join perf_elements e on e.key = i.element_key
                  where i.key = a.item_key and e.track = f.track and i.is_active
                    and (i.roles is null or i.roles && rs));
  return jsonb_build_object('status', 'ok', 'kind', 'staff',
    'settings', jsonb_build_object('code', f.code, 'color', f.color, 'hidden', f.hidden, 'appoint_year', f.appoint_year,
      'perf_rating', f.perf_rating, 'perf_year', f.perf_year, 'other_wins', f.other_wins),
    'data', jsonb_build_object(
      'name', (select full_name from users where id = u), 'year', y, 'track', f.track,
      'job', case when f.track = 'principal' then 'مدير المدرسة' when 'deputy_academic' = any(rs) then 'وكيل الشؤون التعليمية' when 'deputy_school' = any(rs) then 'وكيل الشؤون المدرسية'
                  when 'deputy_students' = any(rs) then 'وكيل شؤون الطلاب' when f.track = 'counselor' then 'الموجه الطلابي'
                  else 'محضر مختبر العلوم' end,
      'auto', au,
      'elements', (select coalesce(jsonb_agg(jsonb_build_object('k', e.key, 't', e.title, 'w', e.weight, 'eo', e.evaluator_only,
                     'items', (select coalesce(jsonb_agg(jsonb_build_object('k', i.key, 't', i.title,
                                'on', au ? i.key or exists (select 1 from perf_evidence v where v.teacher_user_id = u
                                                              and v.item_key = i.key and v.academic_year = y)) order by i.sort_order), '[]')
                                 from perf_items i where i.element_key = e.key and i.is_active and (i.roles is null or i.roles && rs)))
                   order by e.sort_order), '[]')
                    from perf_elements e where e.track = f.track),
      'docs', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'title', v.title, 'el', i.element_key,
                  'kind', case when v.file_name ~* '\.pdf$' then 'pdf' else 'image' end, 'date', coalesce(v.event_date, v.created_at::date))
                  order by v.created_at desc), '[]')
                 from perf_evidence v join perf_items i on i.key = v.item_key join perf_elements el on el.key = i.element_key
                where v.teacher_user_id = u and el.track = f.track and v.source = 'upload' and v.file_path is not null
                  and not ('docs' = any(f.hidden)))));
end; $$;
revoke execute on function public.staff_dfile_public(text) from public;
grant execute on function public.staff_dfile_public(text) to anon, authenticated;
-- نهاية الجزء 2
