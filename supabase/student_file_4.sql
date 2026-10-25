-- =====================================================================
-- ملف الطالب (الجزء 4): التواصل مع ولي الأمر عن طريق البوابة وحدها (لا رسائل نصية).
-- في الفترة المختارة: الإشعارات التي وصلت حساب ولي الأمر وما قرأه منها، وما يحتاج ردّه أو
-- إقراره (نماذج التعهد والدعوة والإشعار، والإحالات، والاستفسارات الإرشادية، والتعاميم التي
-- تطلب الإقرار) وما ردّ عليه، ليُقيَّم ولي الأمر متابعًا لابنه أو لا. بعد student_file_1.sql.
-- =====================================================================

create or replace function public.student_file_guardian(p_student uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t0 timestamptz := p_from::timestamptz; t1 timestamptz := (p_to + 1)::timestamptz; uids uuid[]; items jsonb;
begin
  if not public.sf_can(p_student) then raise exception 'غير مصرّح'; end if;
  select coalesce(array_agg(distinct g.user_id) filter (where g.user_id is not null), '{}') into uids
    from guardian_student gs join guardians g on g.id = gs.guardian_id where gs.student_id = p_student;

  select coalesce(jsonb_agg(x order by x->>'d'), '[]') into items from (
    select jsonb_build_object('kind', 'form', 'title', case b.kind when 'pledge' then 'تعهد' when 'invite' then 'دعوة ولي أمر' else 'إشعار سلوك' end,
             'd', b.created_at, 'replied', b.guardian_ack_at is not null, 'at', b.guardian_ack_at) x
      from behavior_forms b where b.student_id = p_student and b.kind in ('pledge', 'invite', 'notice') and b.created_at >= t0 and b.created_at < t1
    union all
    select jsonb_build_object('kind', 'referral', 'title', 'إحالة طالب', 'd', r.referral_date, 'replied', r.guardian_ack_at is not null, 'at', r.guardian_ack_at)
      from student_referrals r where r.student_id = p_student and r.referral_date >= p_from and r.referral_date <= p_to
    union all
    select jsonb_build_object('kind', 'inquiry', 'title', 'استفسار الموجه عن الطالب', 'd', i.sent_at, 'replied', i.guardian_seen_at is not null, 'at', i.guardian_seen_at)
      from guidance_inquiries i where i.student_id = p_student and i.sent_at >= t0 and i.sent_at < t1
    union all
    select jsonb_build_object('kind', 'circular', 'title', 'تعميم: ' || c.subject, 'd', c.sent_at, 'replied', bool_or(cr.ack_at is not null), 'at', max(cr.ack_at))
      from circular_recipients cr join circulars c on c.id = cr.circular_id
      where cr.user_id = any(uids) and cr.kind = 'guardian' and c.needs_ack and c.sent_at >= t0 and c.sent_at < t1
      group by c.id, c.subject, c.sent_at
  ) q;

  return jsonb_build_object(
    'accounts', coalesce(array_length(uids, 1), 0),
    'notif_total', (select count(distinct nr.notification_id) from notification_recipients nr join notifications n on n.id = nr.notification_id
                    where nr.user_id = any(uids) and n.created_at >= t0 and n.created_at < t1),
    'notif_read', (select count(distinct nr.notification_id) from notification_recipients nr join notifications n on n.id = nr.notification_id
                   where nr.user_id = any(uids) and nr.read_at is not null and n.created_at >= t0 and n.created_at < t1),
    'items', items);
end $$;
revoke all on function public.student_file_guardian(uuid, date, date) from public, anon;
grant execute on function public.student_file_guardian(uuid, date, date) to authenticated;

-- نهاية الجزء 1
