-- =====================================================================
-- شواهد محضر معمل الحاسب (4): إكمال ربط البنود بما في البوابة.
-- • l13_03 رفع الحاجة للصيانة: يضاف إلى البلاغات المحوّلة للصيانة الخارجية بلاغات الصيانة التي رفعها المحضر.
-- • بنود «جزئية» صار لها عدّاد آلي من عمل المعمل: l04_02 حصص دروس المحطات، وl04_04 أجهزة عليها ملف
--   المعمل الدائم (يعمل دون إنترنت)، وl06_03 أسابيع الحجز (يتخطّى الإجازات تلقائيًا)، وl12_03 أجهزة حُدّثت بياناتها.
-- يُنفَّذ بعد lab_perf_2.sql وmaint_1.sql. تكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.lab_perf_auto_core(p_uid uuid, p_year text)
returns table (teacher_user_id uuid, item_key text, cnt bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare y0 date;
begin
  if not exists (select 1 from admin_roles r where r.user_id = p_uid and r.role_type::text = 'computer_lab') then return; end if;
  select coalesce(min(start_date), current_date - 365) into y0 from academic_calendar where academic_year = p_year;
  return query
  select p_uid, x.k, x.n, x.l from (
    select 'l02_05' k, count(distinct b.teacher_id) n, max(b.created_at) l from lab_bookings b where b.booking_date >= y0
    union all select 'l04_01', count(*), max(s.created_at) from lab_sessions s where s.created_at >= y0
    union all select 'l05_01', count(*), max(r.scanned_at) from lab_results r where r.scanned_at >= y0
    union all select 'l05_02', count(*), max(w.created_at) from lab_works w where w.work_date >= y0
    union all select 'l06_01', count(*), max(b.created_at) from lab_bookings b where b.booking_date >= y0
    union all select 'l07_01', count(*), max(t.updated_at) from lab_tickets t where t.status = 'resolved' and t.created_at >= y0
    union all select 'l07_02', count(*), max(d.updated_at) from lab_devices d where coalesce(d.cpu, d.os, d.ram) is not null
    union all select 'l07_03', count(*), max(i.created_at) from lab_installs i
    union all select 'l08_01', count(*), max(d.updated_at) from lab_devices d where d.status = 'ok'
    union all select 'l09_01', coalesce(max(jsonb_array_length(u.items)), 0), max(u.updated_at) from lab_rules u
    union all select 'l09_02', count(distinct a.student_id), max(a.acked_at) from lab_rule_acks a where a.acked_at >= y0
    union all select 'l10_01', count(distinct st.class_id), max(st.updated_at) from lab_seats st
    union all select 'l11_01', count(*), max(b.booking_date)::timestamptz from lab_bookings b
       where b.booking_date between y0 and current_date and coalesce(b.used, true)
    union all select 'l11_02', count(*), max(b.booking_date)::timestamptz from lab_bookings b where b.walk_in and b.booking_date >= y0
    union all select 'l12_01', count(distinct date_trunc('week', b.booking_date + 1)), max(b.booking_date)::timestamptz
       from lab_bookings b where b.booking_date between y0 and current_date
    union all select 'l13_01', count(*), max(d.updated_at) from lab_devices d
    union all select 'l13_02', count(*), max(t.created_at) from lab_tickets t where t.created_at >= y0
    -- رفع الحاجة للصيانة: بلاغات المعمل المحوّلة للصيانة الخارجية، وبلاغات الصيانة التي رفعها المحضر (maint_1.sql)
    union all select 'l13_03', (select count(*) from lab_tickets t where t.status = 'external' and t.created_at >= y0)
                             + (select count(*) from maint_tickets m where m.reported_by = p_uid and m.created_at >= y0),
                    greatest((select max(t.updated_at) from lab_tickets t where t.status = 'external' and t.created_at >= y0),
                             (select max(m.created_at) from maint_tickets m where m.reported_by = p_uid and m.created_at >= y0))
    -- بنود «جزئية» لها عمل مسجّل في البوابة: دروس المحطات، والتعلم دون إنترنت، ومواءمة الحجز مع الإجازات، وتحديث السجلات
    union all select 'l04_02', count(*), max(s.created_at) from lab_sessions s where s.created_at >= y0
    union all select 'l04_04', count(*), max(i.created_at) from lab_installs i
    union all select 'l06_03', count(distinct date_trunc('week', b.booking_date + 1)), max(b.created_at) from lab_bookings b where b.booking_date >= y0
    union all select 'l12_03', count(*), max(d.updated_at) from lab_devices d where d.updated_at >= y0
  ) x where x.n > 0;
end; $$;
revoke execute on function public.lab_perf_auto_core(uuid, text) from public, anon, authenticated;
-- نهاية الجزء 1
