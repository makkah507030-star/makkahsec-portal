-- =====================================================================
-- توقيعات المعلمين في تقرير الاطّلاع على ميثاق أخلاقيات المهنة
-- أصحاب التقرير (المدير ووكيل الشؤون التعليمية والدعم الفني) يرون صورة توقيع
-- من أقرّ بالاطّلاع، من «توقيعي». ومن لم يرفع توقيعه: «✓ أقرّ إلكترونيًا».
-- يُنفَّذ بعد ethics_code.sql وpd_signer_signatures.sql، مرة واحدة في
-- Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

-- مسارات توقيعات من أقرّ بوثيقة
create or replace function public.doc_acks_signatures(p_doc text)
returns table (user_id uuid, path text)
language sql stable security definer set search_path = public as $$
  select s.user_id, s.path from public.user_signatures s
   where public.doc_acks_viewer()
     and exists (select 1 from public.doc_acks a where a.doc_key = p_doc and a.user_id = s.user_id);
$$;
revoke execute on function public.doc_acks_signatures(text) from public, anon;
grant  execute on function public.doc_acks_signatures(text) to authenticated;

-- قراءة ملف التوقيع نفسه: لأصحاب التقرير، ولمن أقرّ فقط
drop policy if exists "read doc ack signatures" on storage.objects;
create policy "read doc ack signatures" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'form-assets'
    and public.doc_acks_viewer()
    and exists (select 1 from public.doc_acks a where a.user_id = public.sig_owner(objects.name))
  );
-- نهاية الملف
