-- =====================================================================
-- بنك الأسئلة (الجزء 3 من 3): ربط المشاركة بشواهد الأداء الوظيفي — البند 2-8 «تقديم إنتاج
-- معرفي…»: عدد الأسئلة التي شاركها المعلم في بنك المدرسة هذا العام، وفي تفاصيلها كم مرة استفاد
-- منها زملاؤه. يُشغَّل بعد qbank_1..2 وبعد perf_auto_core_1..2. تكرار التنفيذ آمن.
-- =====================================================================

-- الأسئلة المشاركة في العام (منذ بداية التقويم الدراسي للعام)
create or replace function public.perf_qbank_core(p_uid uuid, p_year text)
returns table (teacher_user_id uuid, item_key text, cnt bigint, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.owner_id, 'e02_08'::text, count(*), max(coalesce(b.updated_at, b.created_at))
    from qbank b
   where b.shared and (p_uid is null or b.owner_id = p_uid)
     and b.created_at >= coalesce((select min(start_date)::timestamptz from academic_calendar where academic_year = p_year),
                                  now() - interval '1 year')
   group by b.owner_id;
$$;
revoke execute on function public.perf_qbank_core(uuid, text) from public, anon, authenticated;

-- الشواهد الآلية: كما في perf_auto_core_2.sql مع أسئلة البنك
create or replace function public.perf_auto_counts(p_uid uuid, p_year text)
returns table (teacher_user_id uuid, item_key text, cnt bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role(array['principal', 'tech_support'])
     and (p_uid is null or p_uid is distinct from auth.uid()) then
    raise exception 'غير مصرّح';
  end if;
  return query select * from public.perf_auto_counts_core(p_uid, p_year)
         union all select * from public.perf_qbank_core(p_uid, p_year);
end;
$$;

create or replace function public.dfile_auto_evidence(p_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
    select left(c.item_key, 3) k, sum(c.cnt) n from (
      select * from public.perf_auto_counts_core(p_uid, (select value from public.settings where key = 'active_year'))
      union all select * from public.perf_qbank_core(p_uid, (select value from public.settings where key = 'active_year'))) c
     group by 1) x;
$$;
revoke execute on function public.dfile_auto_evidence(uuid) from public, anon, authenticated;

-- تفاصيل الشاهد: كل سؤال مشارك بمادته ودرسه، وكم مرة استفاد منه الزملاء
create or replace function public.perf_qbank_details(p_uid uuid, p_year text, p_item text)
returns table (r_title text, r_detail text, r_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role(array['principal', 'tech_support']) and p_uid is distinct from auth.uid() then
    raise exception 'غير مصرّح';
  end if;
  return query
    select concat_ws(' · ', coalesce(b.subject_name, 'بلا مادة'), b.lesson),
           left(regexp_replace(b.body, '\s+', ' ', 'g'), 120)
             || case when b.uses > 0 then ' — استفاد منه الزملاء ' || b.uses || ' مرة' else '' end,
           coalesce(b.updated_at, b.created_at)
      from qbank b
     where b.shared and b.owner_id = p_uid and p_item = 'e02_08'
       and b.created_at >= coalesce((select min(start_date)::timestamptz from academic_calendar where academic_year = p_year),
                                    now() - interval '1 year')
     order by b.uses desc, b.created_at desc;
end;
$$;
revoke execute on function public.perf_qbank_details(uuid, text, text) from public, anon;
grant execute on function public.perf_qbank_details(uuid, text, text) to authenticated;
-- نهاية الجزء 3
