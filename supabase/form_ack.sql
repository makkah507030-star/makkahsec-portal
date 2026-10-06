-- =====================================================================
-- إقرار المستفيد بالاطلاع على المستند وتوقيعه — «استمارة دعم وتطوير الهيئة
-- التعليمية» وكل نموذج فيه جدول بنود (rubric).
--
-- بعد إرسال الاستمارة للمعلم يفتحها ويؤكد اطلاعه عليها، ويُرفق توقيعه إن
-- رفعه في البوابة. فتتحدّث الاستمارة: يُسجَّل تاريخ الاطلاع وتوقيعه
-- (data.ack_at وreply_signature_*)، ويصل المُصدِرَ إشعار في الجرس.
-- المستند يبقى صادرًا كما هو — لا يعود للاعتماد.
--
-- المعلم لا يملك تعديل مستند صادر بصلاحياته العادية، فيمرّ الإقرار عبر
-- هذه الدالة: تتحقق أنه صاحب المستند، وأنه صادر، وأن نموذجه يقبل الإقرار.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.acknowledge_form_document(p_doc uuid, p_sign boolean default true)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  d   public.form_documents;
  sig text;
  nid uuid;
  at  timestamptz := now();
begin
  select * into d from public.form_documents where id = p_doc for update;
  if not found or d.recipient_user_id is distinct from auth.uid() then
    raise exception 'المستند غير موجود أو ليس موجّهًا إليك';
  end if;
  if d.status not in ('issued', 'approved') then
    raise exception 'لا يُقَرّ بالاطلاع على مستند لم يصدر بعد';
  end if;
  if not exists (
    select 1 from public.form_templates t, jsonb_array_elements(t.fields) f
    where t.id = d.template_id and (f->>'type' = 'rubric' or (f->>'ack')::boolean is true)
  ) then
    raise exception 'هذا النموذج لا يتطلب إقرارًا بالاطلاع';
  end if;

  -- أُقِرّ سابقًا: لا يتغيّر تاريخ الإقرار الأول
  if d.data ? 'ack_at' then
    return (d.data->>'ack_at')::timestamptz;
  end if;

  if p_sign then
    select path into sig from public.user_signatures where user_id = auth.uid();
  end if;

  update public.form_documents
  set data = data || jsonb_build_object('ack_at', at),
      reply_at = at,
      reply_signature_path = sig,
      reply_signature_name = coalesce(nullif(d.recipient, ''),
                                      (select full_name from public.users where id = auth.uid()), '')
  where id = p_doc;

  -- إشعار المُصدِر في الجرس
  insert into public.notifications (title, body, kind, link, is_auto, created_by)
  values (
    'اطلاع على ' || d.title,
    coalesce(nullif(d.recipient, ''), 'المستفيد') || ' اطلع على ' || d.title || ' رقم ' || d.serial ||
      case when sig is not null then ' ووقّعه.' else ' وأقرّ بذلك.' end,
    'general', '/doc/' || d.id, true, auth.uid()
  )
  returning id into nid;
  insert into public.notification_recipients (notification_id, user_id)
  values (nid, d.created_by)
  on conflict do nothing;

  return at;
end;
$$;

revoke all on function public.acknowledge_form_document(uuid, boolean) from public, anon;
grant execute on function public.acknowledge_form_document(uuid, boolean) to authenticated;
