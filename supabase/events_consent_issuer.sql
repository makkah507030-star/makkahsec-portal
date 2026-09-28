-- =====================================================================
-- نماذج موافقة الفعاليات الصادرة قبل الإصلاح: خانة «المعلم» ظهرت فارغة
-- لأن اسم المُصدِر لم يُحفظ في المستند. يُكمل هذا الملف الاسم والصفة
-- والتوقيع المحفوظ لمنظّم الحدث في النماذج السابقة.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- =====================================================================
update public.form_documents d
set signature_name = coalesce(nullif(ev.organizer_name, ''), pr.full_name, ''),
    signature_role = case when coalesce(ev.organizer_role, '') in ('', 'معلم') then 'المعلم' else ev.organizer_role end,
    signature_path = coalesce(d.signature_path, us.path)
from public.event_participants ep
join public.school_events ev on ev.id = ep.event_id
left join public.users pr on pr.id = ev.organizer_id
left join public.user_signatures us on us.user_id = ev.organizer_id
where ep.consent_doc_id = d.id
  and coalesce(d.signature_name, '') = '';
