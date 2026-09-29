-- إشعارات الجوال الصادرة من قاعدة البيانات (التأخر الصباحي، الغياب الرسمي، نشر
-- الاختبار الإلكتروني): push-send صار يرفض الطلب غير المفوَّض، فترسل
-- push_notification مفتاحًا سريًّا مشتركًا تقرؤه من خزنة Supabase (Vault).
-- يُنفَّذ بعد حفظ المفتاح في الخزنة باسم push_internal_secret، وفي Netlify
-- بالاسم PUSH_INTERNAL_SECRET بالقيمة نفسها. تكرار التنفيذ آمن.
-- لا يُكتب المفتاح هنا ولا في أي ملف في المستودع.

create or replace function public.push_notification(p_nid uuid)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare
  v_secret text;
begin
  if p_nid is null then return; end if;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'push_internal_secret' limit 1;
  perform net.http_post(
    url     := 'https://makkahsec.com/.netlify/functions/push-send',
    body    := jsonb_build_object('notification_id', p_nid),
    headers := jsonb_build_object('Content-Type', 'application/json')
               || case when v_secret is null then '{}'::jsonb
                  else jsonb_build_object('Authorization', 'Bearer ' || v_secret) end
  );
exception when others then
  -- فشل الدفع لا يُعطّل أي شيء
  return;
end $fn$;

-- الدالة تقرأ مفتاحًا سريًّا: لا يستدعيها إلا الخادم ودوال قاعدة البيانات
revoke execute on function public.push_notification(uuid) from public, anon, authenticated;
