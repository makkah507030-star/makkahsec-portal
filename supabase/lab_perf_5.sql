-- شواهد محضر معمل الحاسب (5): تفاصيل البنود الآلية الجديدة («عرض الشواهد»): دروس المحطات، والتعلم دون إنترنت،
-- وأسابيع الحجز، وتحديث السجلات، ورفع الحاجة للصيانة مع بلاغات الصيانة. يُنفَّذ بعد lab_perf_4.sql. تكرار التنفيذ آمن.
create or replace function public.lab_perf_details(p_uid uuid, p_year text, p_item text)
returns table (r_title text, r_detail text, r_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare y0 date;
  st jsonb := '{"new":"جديد","in_progress":"قيد المعالجة","external":"صيانة خارجية","resolved":"حُلّ","ok":"يعمل","broken":"معطّل","maintenance":"في الصيانة"}';
begin
  if not exists (select 1 from admin_roles r where r.user_id = p_uid and r.role_type::text = 'computer_lab')
     or not (p_uid = auth.uid() or public.has_admin_role(array['principal', 'tech_support'])) then return; end if;
  select coalesce(min(start_date), current_date - 365) into y0 from academic_calendar where academic_year = p_year;
  if p_item in ('l02_05', 'l06_01', 'l06_03', 'l11_01', 'l11_02', 'l12_01') then
    return query select case when p_item in ('l12_01', 'l06_03')
             then 'أسبوع ' || to_char((date_trunc('week', b.booking_date + 1) - interval '1 day')::date, 'YYYY-MM-DD')
             else coalesce(t.full_name, 'معلم') end,
           'الحصة ' || b.period_no || coalesce(' · الفصل ' || c.grade || '/' || c.class_no, '') || coalesce(' · ' || b.lesson, '')
             || case when b.used is false then ' · لم تُستخدم' when b.walk_in then ' · بلا حجز سابق' else '' end,
           b.booking_date::timestamptz
      from lab_bookings b left join teachers t on t.id = b.teacher_id left join classes c on c.id = b.class_id
     where b.booking_date >= y0
       and (p_item in ('l02_05', 'l06_01', 'l06_03') or (b.booking_date <= current_date
            and (p_item <> 'l11_01' or coalesce(b.used, true)) and (p_item <> 'l11_02' or b.walk_in)))
     order by b.booking_date desc, b.period_no;
  elsif p_item in ('l04_01', 'l04_02', 'l05_01') then
    return query select s.lesson_title,
           'الفصل ' || c.grade || '/' || c.class_no || case when p_item = 'l05_01'
             then coalesce(' · إتقان ' || r.mastery || '%', '') || coalesce(' · الاختبار ' || r.quiz || '%', '') else '' end,
           case when p_item = 'l05_01' then r.scanned_at else s.created_at end
      from lab_sessions s join classes c on c.id = s.class_id
      left join lab_results r on p_item = 'l05_01' and r.session_id = s.id
     where s.created_at >= y0 and (p_item in ('l04_01', 'l04_02') or r.session_id is not null)
     order by 3 desc;
  elsif p_item = 'l05_02' then
    return query select w.title, 'الفصل ' || c.grade || '/' || c.class_no || ' · من ' || w.max_mark, w.work_date::timestamptz
      from lab_works w join classes c on c.id = w.class_id where w.work_date >= y0 order by w.work_date desc;
  elsif p_item = 'l13_03' then
    -- البلاغات المحوّلة للصيانة الخارجية، وبلاغات الصيانة التي رفعها المحضر
    return query select * from (
      select t.category, 'الجهاز ' || t.seat_no || ' · صيانة خارجية' || coalesce(' · ' || t.resolution, ''), t.created_at
        from lab_tickets t where t.created_at >= y0 and t.status = 'external'
      union all
      select 'بلاغ صيانة: ' || m.category, m.place_kind || coalesce(' · ' || m.place, '') || ' · رقم ' || m.id, m.created_at
        from maint_tickets m where m.reported_by = p_uid and m.created_at >= y0) z order by 3 desc;
  elsif p_item in ('l07_01', 'l13_02') then
    return query select t.category, 'الجهاز ' || t.seat_no || ' · ' || coalesce(st ->> t.status, t.status) || coalesce(' · ' || t.resolution, ''),
           t.created_at from lab_tickets t
     where t.created_at >= y0 and (p_item = 'l13_02' or t.status = case p_item when 'l07_01' then 'resolved' else 'external' end)
     order by t.created_at desc;
  elsif p_item in ('l07_02', 'l08_01', 'l13_01', 'l12_03') then
    return query select coalesce(st ->> d.status, d.status),
           'الجهاز ' || d.seat_no || ' · ' || d.code || coalesce(' · ' || nullif(concat_ws('، ', d.cpu, d.ram, d.os), ''), ''), d.updated_at
      from lab_devices d where (p_item = 'l13_01' or (p_item = 'l12_03' and d.updated_at >= y0) or (p_item = 'l08_01' and d.status = 'ok') or (p_item = 'l07_02' and coalesce(d.cpu, d.os, d.ram) is not null))
     order by d.seat_no;
  elsif p_item in ('l07_03', 'l04_04') then
    return query select 'ملف المعمل الدائم'::text, 'رمز الملف ' || i.code, i.created_at from lab_installs i order by i.created_at desc;
  elsif p_item = 'l09_01' then
    return query select 'قواعد السلامة · الإصدار ' || u.version, x.v, u.updated_at
      from lab_rules u, jsonb_array_elements_text(u.items) x(v) where u.id = 1;
  elsif p_item = 'l09_02' then
    return query select 'إقرارات الفصل الدراسي ' || a.term_key, count(distinct a.student_id) || ' طالبًا أقرّوا', max(a.acked_at)
      from lab_rule_acks a where a.acked_at >= y0 group by a.term_key;
  elsif p_item = 'l10_01' then
    return query select 'الفصل ' || c.grade || '/' || c.class_no, count(*) || ' طالبًا في الخريطة', max(s.updated_at)
      from lab_seats s join classes c on c.id = s.class_id group by c.grade, c.class_no order by c.grade, c.class_no;
  end if;
end; $$;
revoke execute on function public.lab_perf_details(uuid, text, text) from public, anon;
grant execute on function public.lab_perf_details(uuid, text, text) to authenticated;
-- نهاية الجزء 2
