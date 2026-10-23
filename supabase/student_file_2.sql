-- =====================================================================
-- ملف الطالب الشامل (الجزء 2 من 3): السلوك والإحالات والتوجيه والملاحظات والتواصل مع ولي الأمر.
-- يُشغَّل بعد الجزء 1. الملاحظات السرية يُعرض نصها لمن يكتب نوعها وحده، ولغيره وجودها فقط.
-- تكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.student_file_conduct(p_student uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb; t0 timestamptz := p_from::timestamptz; t1 timestamptz := (p_to + 1)::timestamptz;
begin
  if not public.sf_can(p_student) then raise exception 'غير مصرّح'; end if;
  select jsonb_build_object(
    'behavior', (select coalesce(jsonb_agg(jsonb_build_object('kind', b.kind, 'serial', b.serial, 'degree', b.violation_degree,
                  'type', b.violation_type, 'text', b.violation_text, 'd', coalesce(b.violation_date, b.created_at::date),
                  'status', b.status, 'by', b.issued_name, 'ack', b.guardian_ack_at is not null) order by b.created_at), '[]')
                 from behavior_forms b where b.student_id = p_student and b.created_at >= t0 and b.created_at < t1),
    'actions', (select coalesce(jsonb_agg(jsonb_build_object('category', a.category, 'action', a.action, 'detail', a.detail,
                  'degree', a.violation_degree, 'd', a.action_date,
                  'by', (select t.full_name from teachers t where t.id = a.teacher_id)) order by a.action_date), '[]')
                 from student_actions a where a.student_id = p_student and a.action_date between p_from and p_to),
    'referrals', (select coalesce(jsonb_agg(jsonb_build_object('serial', r.serial, 'd', r.referral_date, 'reason', r.reason,
                  'subject', r.subject, 'teacher', r.teacher_name, 'status', r.status, 'closed_at', r.closed_at,
                  'deputy_note', r.deputy_note, 'counselor_note', r.counselor_note, 'close_note', r.close_note,
                  'ack', r.guardian_ack_at is not null) order by r.referral_date), '[]')
                 from student_referrals r where r.student_id = p_student and r.referral_date between p_from and p_to),
    'cases', (select coalesce(jsonb_agg(jsonb_build_object('title', c.title, 'source', c.source, 'status', c.status,
                  'outcome', c.outcome, 'opened', c.opened_at, 'closed', c.closed_at,
                  'sessions', (select count(*) from guidance_sessions gs where gs.case_id = c.id),
                  'last', (select gs.recommendation from guidance_sessions gs where gs.case_id = c.id
                            order by gs.session_date desc limit 1)) order by c.opened_at), '[]')
                 from guidance_cases c where c.student_id = p_student and c.opened_at < t1
                  and (c.closed_at is null or c.closed_at >= t0)),
    'inquiries', (select coalesce(jsonb_agg(jsonb_build_object('d', i.sent_at, 'flag', i.flag, 'status', i.status,
                  'items', (select coalesce(jsonb_agg(jsonb_build_object('subject', it.subject, 'academic', it.academic,
                     'behavior', it.behavior, 'note', it.note) order by it.sort), '[]')
                     from guidance_inquiry_items it where it.inquiry_id = i.id)) order by i.created_at), '[]')
                 from guidance_inquiries i where i.student_id = p_student and i.created_at >= t0 and i.created_at < t1),
    'notes', (select coalesce(jsonb_agg(jsonb_build_object('kind', n.kind, 'confidential', n.confidential,
                  'body', case when not n.confidential or public.sn_can_write(n.kind) then n.body end,
                  'by', n.created_by_name, 'd', n.created_at, 'review_until', n.review_until) order by n.created_at desc), '[]')
                 from student_notes n where n.student_id = p_student and n.is_active),
    'sms', (select jsonb_build_object('total', count(*), 'sent', count(*) filter (where l.status = 'sent'),
                  'types', (select coalesce(jsonb_object_agg(k, c), '{}') from
                    (select coalesce(l2.msg_type, 'other') k, count(*) c from sms_logs l2
                      where l2.student_id = p_student and l2.created_at >= t0 and l2.created_at < t1 group by 1) x))
                 from sms_logs l where l.student_id = p_student and l.created_at >= t0 and l.created_at < t1)
  ) into v;
  return v;
end $$;

revoke all on function public.student_file_conduct(uuid, date, date) from public, anon;
grant execute on function public.student_file_conduct(uuid, date, date) to authenticated;
-- نهاية الجزء 2
