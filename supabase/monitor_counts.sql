-- =====================================================================
-- شاشة المتابعة: أعداد اليوم كاملة لكل من تظهر له الشاشة (المدير والوكلاء
-- الثلاثة والدعم الفني)، فلا تظهر أصفارًا لمن لا يقرأ الإحالات أو الأحداث
-- أو الاختبارات بصلاحياته. أعداد وعناوين أحداث فقط، بلا أسماء طلاب.
-- تكرار تنفيذه آمن.
-- =====================================================================

create or replace function public.monitor_counts(p_date date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t0 timestamptz := p_date::timestamp at time zone 'Asia/Riyadh';  -- بداية اليوم بتوقيت مكة
  wk date := p_date + 7;
begin
  if not public.has_admin_role(array['principal', 'deputy_students', 'deputy_academic', 'deputy_school', 'tech_support']) then
    return null;
  end if;
  return jsonb_build_object(
    'refsToday', (select count(*) from student_referrals where referral_date = p_date),
    'refsOpen', (select count(*) from student_referrals
                 where status in ('with_deputy', 'with_counselor', 'returned_to_counselor', 'returned_to_teacher', 'with_guardian')),
    'behavior', (select count(*) from behavior_forms where created_at >= t0),
    'invites', (select count(*) from behavior_forms where kind in ('invite', 'notice') and created_at >= t0),
    'quizzes', (select count(*) from quizzes where exam_date = p_date and status <> 'draft'),
    'nextQuizzes', (select count(*) from quizzes where exam_date > p_date and exam_date <= wk and status <> 'draft'),
    'notes', (select count(*) from notifications where created_at >= t0),
    'toGuardians', (select count(*) from notification_recipients r join notifications n on n.id = r.notification_id
                    join users u on u.id = r.user_id where n.created_at >= t0 and u.role::text = 'guardian'),
    'absenceNotes', (select count(*) from official_absence_notified where attend_date = p_date),
    'guardianForms', (select count(*) from form_documents d join form_templates t on t.id = d.template_id
                      where t.key in ('guidance_guardian_call', 'guidance_guardian_meeting') and d.created_at >= t0),
    'circs', (select count(*) from circulars where sent_at >= t0),
    'events', coalesce((select jsonb_agg(e order by e.event_date desc) from (
        select title, category, event_date, end_date, start_time, venue from school_events
        where event_date <= p_date and (event_date = p_date or end_date >= p_date)
          and stage <> 'draft' and cancelled_at is null) e), '[]'),
    'nextEvents', coalesce((select jsonb_agg(e order by e.event_date) from (
        select title, category, event_date, start_time from school_events
        where event_date > p_date and event_date <= wk and stage <> 'draft' and cancelled_at is null
        order by event_date limit 6) e), '[]'));
end $$;
revoke execute on function public.monitor_counts(date) from public, anon;
grant  execute on function public.monitor_counts(date) to authenticated;

-- نهاية الجزء 1
