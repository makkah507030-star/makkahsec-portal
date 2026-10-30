-- =====================================================================
-- قسم التقويم والاعتماد المدرسي (6): شواهد جاهزة من أعمال البوابة. acc_portal_counts تعدّ لكل مصدر
-- (الفعاليات، والإحالات، والبرامج الإرشادية، ومجتمعات التعلم…) ما سُجّل في العام الدراسي النشط،
-- فيظهر في «المؤشرات والشواهد» شاهدًا جاهزًا للمؤشرات المرتبطة به (الربط في src/lib/accPortal.js).
-- أعداد فقط بلا أسماء ولا محتوى، لأعضاء لجنة التميز. المصدر الذي لم يُفعَّل جدوله يُتجاوز ولا يُفشل البقية.
-- يُنفَّذ بعد acc_5.sql، وتكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.acc_portal_counts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  y text := (select value from settings where key = 'active_year');
  y0 date;
  r jsonb := '{}';
  s record;
  n bigint;
begin
  if not public.acc_member() then raise exception 'غير مصرّح'; end if;
  select coalesce(min(start_date), current_date - 365) into y0 from academic_calendar where academic_year = y;
  for s in select * from (values
    ('events', 'select count(*) from school_events where stage = ''approved'' and cancelled_at is null and event_date >= $2'),
    ('event_reports', 'select count(*) from school_events where report_at is not null and cancelled_at is null and event_date >= $2'),
    ('event_consents', 'select count(*) from event_participants where consent_at is not null and created_at >= $2'),
    ('behavior', 'select count(*) from behavior_forms where created_at >= $2'),
    ('referrals', 'select count(*) from student_referrals where referral_date >= $2'),
    ('g_programs', 'select count(*) from guidance_programs where academic_year = $1'),
    ('g_cases', 'select count(*) from guidance_cases where academic_year = $1'),
    ('g_sessions', 'select count(*) from guidance_sessions where session_date >= $2'),
    ('gifted', 'select count(*) from gifted_programs where academic_year = $1'),
    ('mawhiba', 'select count(*) from mawhiba_tracking where academic_year = $1'),
    ('nominations', 'select count(*) from nom_calls where cancelled_at is null and created_at >= $2'),
    ('polls', 'select count(*) from polls where cancelled_at is null and created_at >= $2'),
    ('notifications', 'select count(*) from notifications where created_at >= $2'),
    ('news', 'select count(*) from news where is_published and coalesce(published_at, created_at) >= $2'),
    ('media', 'select count(*) from media_items where created_at >= $2'),
    ('circulars', 'select count(*) from circulars where academic_year = $1'),
    ('pd', 'select count(*) from pd_reports where academic_year = $1'),
    ('plc', 'select count(*) from plc_sessions where academic_year = $1'),
    ('xvisits', 'select count(*) from exchange_visits where academic_year = $1'),
    ('improve', 'select count(*) from improvement_goals where academic_year = $1'),
    ('ethics', 'select count(*) from doc_acks where acked_at >= $2'),
    ('acc_meetings', 'select count(*) from acc_meetings where academic_year = $1'),
    ('ach_meetings', 'select count(*) from ach_meetings where academic_year = $1'),
    ('attendance', 'select count(distinct attend_date) from daily_attendance where academic_year = $1'),
    ('class_att', 'select count(*) from class_attendance where academic_year = $1'),
    ('warnings', 'select count(*) from absence_warnings where academic_year = $1'),
    ('excuses', 'select count(*) from excused_absences where academic_year = $1'),
    ('permissions', 'select count(*) from permission_requests where created_at >= $2'),
    ('substitute', 'select count(*) from substitute_periods where academic_year = $1'),
    ('activities', 'select count(*) from activity_uses where created_at >= $2'),
    ('quizzes', 'select count(*) from quizzes where academic_year = $1'),
    ('notices', 'select count(*) from period_notices where academic_year = $1 and published'),
    ('lab', 'select count(*) from lab_sessions where created_at >= $2'),
    ('lab_tickets', 'select count(*) from lab_tickets where created_at >= $2'),
    ('qudrat', 'select count(distinct user_id) from qudrat_answers where created_at >= $2'),
    ('qudrat_mocks', 'select count(*) from qudrat_mocks where created_at >= $2'),
    ('qiyas', 'select count(*) from qiyas_results where status = ''verified'''),
    ('national', 'select count(*) from acc_national'),
    ('globe', 'select count(*) from globe_programs where academic_year = $1'),
    ('scouts', 'select count(*) from scout_reports where created_at >= $2')
  ) v(k, q) loop
    begin
      execute s.q into n using y, y0;
      r := r || jsonb_build_object(s.k, n);
    exception when others then null;   -- جدول لم يُفعَّل أو عمود تغيّر: يُتجاوز المصدر وحده
    end;
  end loop;
  return r;
end; $$;

revoke all on function public.acc_portal_counts() from public, anon;
grant execute on function public.acc_portal_counts() to authenticated;

-- نهاية الجزء 1
