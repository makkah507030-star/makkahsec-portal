-- =====================================================================
-- صور توقيعات الموقّعين في نماذج التطوير المهني بدل «✓ وُقّع إلكترونيًا»
-- (جلسات مجتمع التعلم المهني، ونماذج سجل التطوير المهني، والزيارات التبادلية)
--
-- من يستطيع فتح النموذج يرى صورة توقيع من وقّع عليه، من «توقيعي».
-- من لم يرفع توقيعًا تبقى خانته «✓ وُقّع إلكترونيًا».
-- يُنفَّذ بعد staff_signatures_read.sql، مرة واحدة في Supabase ← SQL Editor،
-- وتكرار التنفيذ آمن.
-- =====================================================================

-- صاحب ملف التوقيع من مساره
create or replace function public.sig_owner(p_path text)
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from user_signatures where path = p_path limit 1;
$$;

-- مسارات توقيعات أشخاص معيّنين (المسار وحده لا يكفي للقراءة؛ السياسة أدناه تقرّر)
create or replace function public.signer_signatures(p_users uuid[])
returns table (user_id uuid, path text)
language sql stable security definer set search_path = public as $$
  select s.user_id, s.path from user_signatures s
   where s.user_id = any(p_users) and public.is_school_staff();
$$;

revoke execute on function public.sig_owner(text) from public, anon;
revoke execute on function public.signer_signatures(uuid[]) from public, anon;
grant  execute on function public.sig_owner(text) to authenticated;
grant  execute on function public.signer_signatures(uuid[]) to authenticated;

-- قراءة ملف التوقيع: إن كان صاحبه وقّع على نموذج يستطيع المستخدم فتحه
-- (الاستعلامات الفرعية تخضع لصلاحيات قراءة النماذج نفسها)
drop policy if exists "read pd signer signatures" on storage.objects;
create policy "read pd signer signatures" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'form-assets'
    and public.is_school_staff()
    and (
      exists (select 1 from public.plc_signatures g where g.user_id = public.sig_owner(objects.name))
      or exists (select 1 from public.plc_sessions s where s.head_user_id = public.sig_owner(objects.name))
      or exists (select 1 from public.pd_signatures g where g.user_id = public.sig_owner(objects.name))
      or exists (select 1 from public.exchange_visits v
                  where public.sig_owner(objects.name) in (v.visitor_user_id, v.host_user_id))
    )
  );
-- نهاية الملف
