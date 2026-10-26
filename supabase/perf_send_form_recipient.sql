-- إرسال الشهادة إلى ملف الشواهد من مستلِمها (المنسوب)، لا مُصدِرها فقط.
-- قبل هذا كان perf_send_form يرفض أي مستند ليس من إصدار صاحب الملف، فلم تنعكس
-- الشهادة الصادرة باسم المعلم (حضور ورشة، شكر وتقدير) على شواهد أدائه.
-- الآن: المُصدِر كما كان، ويُسمح للمستلِم بإرسال «شهادة» صادرة باسمه فقط.
-- شغّله في Supabase ← SQL Editor، وتكراره آمن. (لا نشر؛ يسري فورًا.)

create or replace function public.perf_send_form(p_doc uuid, p_item text, p_year text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  d   public.form_documents;
  it  public.perf_items;
  ev  public.perf_evidence;
  only_eval boolean;
  is_cert boolean;
begin
  select * into d from public.form_documents where id = p_doc;
  if not found then
    raise exception 'المستند غير موجود';
  end if;
  -- المُصدِر: كما كان. المستلِم: يُسمح له بالشهادات الصادرة باسمه فقط.
  if d.created_by is distinct from auth.uid() then
    if d.recipient_user_id is distinct from auth.uid() then
      raise exception 'المستند ليس من إصدارك ولا موجّهًا إليك';
    end if;
    select exists (select 1 from public.form_templates t
                    where t.id = d.template_id and t.category = 'certificate') into is_cert;
    if not coalesce(is_cert, false) then
      raise exception 'لا تُرسل إلى ملفك إلا الشهادات الصادرة باسمك';
    end if;
  end if;
  if d.status in ('draft', 'pending', 'rejected') then
    raise exception 'المستند لم يصدر بعد';
  end if;
  select * into it from public.perf_items where key = p_item and is_active;
  select evaluator_only into only_eval from public.perf_elements where key = it.element_key;
  if it.key is null or coalesce(only_eval, false) then
    raise exception 'هذا البند لا يقبل شواهد';
  end if;
  if coalesce(p_year, '') = '' then
    raise exception 'العام الدراسي غير محدد';
  end if;

  if it.is_record then
    select * into ev from public.perf_evidence
     where teacher_user_id = auth.uid() and item_key = p_item and form_document_id = p_doc;
    if found then return 1; end if;
    insert into public.perf_evidence (teacher_user_id, academic_year, item_key, source, title,
                                      form_document_id, form_docs, event_date)
    values (auth.uid(), p_year, p_item, 'form', d.title || ' · ' || d.serial,
            p_doc, array[p_doc], d.created_at::date);
    return 1;
  end if;

  select * into ev from public.perf_evidence
   where teacher_user_id = auth.uid() and academic_year = p_year and item_key = p_item
   for update;
  if not found then
    insert into public.perf_evidence (teacher_user_id, academic_year, item_key, source, title,
                                      form_document_id, form_docs, event_date)
    values (auth.uid(), p_year, p_item, 'form', d.title || ' · ' || d.serial,
            p_doc, array[p_doc], d.created_at::date);
    return 1;
  end if;
  if p_doc = any(ev.form_docs) then
    return ev.use_count;
  end if;
  update public.perf_evidence
     set use_count = use_count + 1, form_docs = form_docs || p_doc, last_used_at = now()
   where id = ev.id;
  return ev.use_count + 1;
end;
$$;

revoke execute on function public.perf_send_form(uuid, text, text) from public, anon;
grant  execute on function public.perf_send_form(uuid, text, text) to authenticated;
-- نهاية الجزء 1
