-- =====================================================================
-- الإشراف اليومي في شواهد الأداء (4 نوفمبر 2026)، من سجلات الإشراف المعتمدة (supervision_log.sql):
-- • e01_06 «الالتزام بالمناوبة اليومية وفق الجدول المعد» للمعلم: أيام حضوره عضوًا (حاضر أو متأخر)، وأيام متابعته مشرفًا.
-- • d06_06 «إجراءات الانضباط في مجال العمل (الحضور والانصراف والإشراف)» لوكيلي الشؤون التعليمية والمدرسية:
--   أيام الإشراف المعتمدة في المدرسة.
-- البندان «متوفر جزئيًا»: يصلان تلقائيًا، ويُكملان برفع شاهد (المناوبة وغيرها). يُنفَّذ بعد supervision_log.sql. تكرار التنفيذ آمن.
-- =====================================================================
update public.perf_items set portal = 'partial' where key in ('e01_06', 'd06_06');

-- أيام كل مستخدم: (المستخدم، البند، اليوم، الوصف)
create or replace function public.sup_perf_rows(p_uid uuid, y0 date)
returns table (uid uuid, item text, d date, detail text)
language sql stable security definer set search_path = public as $$
  select (m ->> 'user_id')::uuid, 'e01_06', l.log_date,
         'عضو في الإشراف اليومي · ' || case m ->> 'status' when 'late' then 'متأخر' else 'حاضر' end
    from supervision_log l cross join lateral jsonb_array_elements(l.members) m
   where l.status = 'approved' and l.log_date >= y0 and m ->> 'status' in ('present', 'late')
     and coalesce(m ->> 'user_id', '') <> '' and (p_uid is null or m ->> 'user_id' = p_uid::text)
  union all
  select l.supervisor_id, 'e01_06', l.log_date, 'المشرف المتابع للإشراف اليومي'
    from supervision_log l where l.status = 'approved' and l.log_date >= y0 and (p_uid is null or l.supervisor_id = p_uid)
  union all
  select ar.user_id, 'd06_06', l.log_date,
         'سجل إشراف معتمد · ' || coalesce(l.supervisor_name, '') || ' · غائب ' ||
         (select count(*) from jsonb_array_elements(l.members) x where x ->> 'status' = 'absent')
    from supervision_log l join admin_roles ar on ar.role_type::text in ('deputy_academic', 'deputy_school')
   where l.status = 'approved' and l.log_date >= y0 and (p_uid is null or ar.user_id = p_uid);
$$;
revoke all on function public.sup_perf_rows(uuid, date) from public, anon, authenticated;

-- العدّاد: لصاحب الملف نفسه، وللمدير والدعم الفني (وللكل حين p_uid فارغ)
create or replace function public.sup_perf_auto(p_uid uuid, p_year text)
returns table (teacher_user_id uuid, item_key text, cnt bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare y0 date;
begin
  if p_uid is distinct from auth.uid() and not public.has_admin_role(array['principal', 'tech_support']) then return; end if;
  select coalesce(min(start_date), current_date - 365) into y0 from academic_calendar where academic_year = p_year;
  return query select r.uid, r.item, count(distinct r.d), max(r.d)::timestamptz
    from public.sup_perf_rows(p_uid, y0) r where r.uid is not null group by 1, 2;
end $$;

create or replace function public.sup_perf_details(p_uid uuid, p_year text, p_item text)
returns table (r_title text, r_detail text, r_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare y0 date;
begin
  if p_uid is distinct from auth.uid() and not public.has_admin_role(array['principal', 'tech_support']) then return; end if;
  select coalesce(min(start_date), current_date - 365) into y0 from academic_calendar where academic_year = p_year;
  return query select 'الإشراف اليومي'::text, r.detail, r.d::timestamptz
    from public.sup_perf_rows(p_uid, y0) r where r.item = p_item order by 3 desc;
end $$;
revoke all on function public.sup_perf_auto(uuid, text), public.sup_perf_details(uuid, text, text) from public, anon;
grant execute on function public.sup_perf_auto(uuid, text), public.sup_perf_details(uuid, text, text) to authenticated;
-- نهاية الجزء 1
