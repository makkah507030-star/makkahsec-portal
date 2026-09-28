-- =====================================================================
-- مزامنة التوقيع في موافقات الحدث الصادرة: اسم المنظّم وصفته، والمعلمون
-- المشاركون في التنظيم. تُستدعى من صفحة الحدث بعد تغيير صفة المنظّم أو
-- إضافة معلم مشارك أو إزالته — لأن المستندات الصادرة لا يعدّلها المنظّم
-- مباشرةً بعد ردّ ولي الأمر.
--
-- يتطلب تنفيذ events_co_organizers.sql قبله.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- =====================================================================

create or replace function public.ev_sync_consent_signers(p_event public.school_events.id%type)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  ev public.school_events%rowtype;
  n  integer;
begin
  select * into ev from public.school_events where id = p_event;
  if not found then raise exception 'الحدث غير موجود'; end if;

  if not (
    ev.organizer_id = auth.uid()
    or exists (select 1 from jsonb_array_elements(coalesce(ev.co_organizers, '[]'::jsonb)) c
               where c->>'user_id' = auth.uid()::text)
    or exists (select 1 from public.admin_roles r
               where r.user_id = auth.uid() and r.role_type in ('principal', 'tech_support'))
  ) then
    raise exception 'لا تملك صلاحية تعديل موافقات هذا الحدث';
  end if;

  update public.form_documents d
  set signature_name = coalesce(nullif(ev.organizer_name, ''), d.signature_name, ''),
      signature_role = case when coalesce(ev.organizer_role, '') in ('', 'معلم') then 'المعلم'
                            else ev.organizer_role end,
      co_signers     = coalesce(ev.co_organizers, '[]'::jsonb)
  from public.event_participants ep
  where ep.event_id = ev.id and ep.consent_doc_id = d.id;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.ev_sync_consent_signers(public.school_events.id%type) from public;
grant  execute on function public.ev_sync_consent_signers(public.school_events.id%type) to authenticated;

-- مزامنة لمرة واحدة: المعلمون المشاركون المضافون سابقًا في كل الموافقات الصادرة
update public.form_documents d
set co_signers = coalesce(ev.co_organizers, '[]'::jsonb)
from public.event_participants ep
join public.school_events ev on ev.id = ep.event_id
where ep.consent_doc_id = d.id
  and d.co_signers is distinct from coalesce(ev.co_organizers, '[]'::jsonb);
