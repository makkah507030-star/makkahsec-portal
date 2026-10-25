-- =====================================================================
-- نتائج قياس — الجزء 2 من 2: إدخال الطالب نتيجته بإثباتها، وتحقق اللجنة، ومخزن الإثباتات.
-- يُنفَّذ بعد qiyas_results.sql. تكرار التنفيذ آمن.
-- =====================================================================

-- الطالب يُدخل نتيجته اختياريًا (أو يصحّحها) فتعود «بانتظار التحقق»، ولا تستبدل نتيجة رسمية
create or replace function public.qiyas_submit(p_test text, p_attempt text, p_score numeric, p_taken_on date, p_proof text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_sid uuid; v_id uuid; v_year text;
begin
  select id into v_sid from students where user_id = auth.uid() limit 1;
  if v_sid is null then raise exception 'هذه الخدمة للطالب من حسابه'; end if;
  if p_test not in ('qudrat', 'tahsili', 'step') or p_score is null or p_score < 0 or p_score > 100 then raise exception 'بيانات غير صالحة'; end if;
  if p_proof is not null and p_proof not like auth.uid()::text || '/%' then raise exception 'ملف الإثبات غير صالح'; end if;
  select value into v_year from settings where key = 'active_year';
  insert into qiyas_results (student_id, test, attempt, score, taken_on, academic_year, source, status, proof_path, uploader_name)
  values (v_sid, p_test, coalesce(nullif(trim(p_attempt), ''), 'المحاولة الأولى'), p_score, p_taken_on, coalesce(v_year, ''),
          'student', 'pending', p_proof, (select full_name from users where id = auth.uid()))
  on conflict (student_id, test, attempt) do update set score = excluded.score, taken_on = excluded.taken_on,
    proof_path = coalesce(excluded.proof_path, qiyas_results.proof_path), status = 'pending', source = 'student',
    reject_reason = null, verified_by_name = null, verified_at = null, updated_at = now()
    where qiyas_results.source = 'student'
  returning id into v_id;
  if v_id is null then raise exception 'نتيجتك في هذه المحاولة مسجّلة رسميًا من تقرير المركز'; end if;
  return v_id;
end $$;

-- تحقق اللجنة أو الوكيل: اعتماد، أو رفض بسبب يصل الطالب
create or replace function public.qiyas_verify(p_id uuid, p_ok boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r qiyas_results; v_user uuid;
begin
  if not public.qiyas_can_write() then raise exception 'غير مصرّح'; end if;
  if not p_ok and coalesce(trim(p_reason), '') = '' then raise exception 'اكتب سبب الرفض'; end if;
  update qiyas_results set status = case when p_ok then 'verified' else 'rejected' end, reject_reason = case when p_ok then null else trim(p_reason) end,
    verified_by_name = (select full_name from users where id = auth.uid()), verified_at = now(), updated_at = now()
  where id = p_id returning * into r;
  select user_id into v_user from students where id = r.student_id;
  if v_user is not null and not p_ok then
    perform public.send_notification('لم تُعتمد نتيجتك في ' || case r.test when 'qudrat' then 'القدرات' when 'tahsili' then 'التحصيلي' else 'STEP' end,
      trim(p_reason) || ' — صحّحها من «نتائج قياس».', 'general', '/my-qiyas', null, array[v_user], null, null, true);
  end if;
end $$;
revoke all on function public.qiyas_submit(text, text, numeric, date, text), public.qiyas_verify(uuid, boolean, text) from public, anon;
grant execute on function public.qiyas_submit(text, text, numeric, date, text), public.qiyas_verify(uuid, boolean, text) to authenticated;

-- مخزن الإثباتات: مجلد باسم حساب الطالب؛ يرفعه الطالب ويقرؤه هو واللجنة والوكيل
insert into storage.buckets (id, name, public, file_size_limit)
values ('qiyas-proofs', 'qiyas-proofs', false, 5242880) on conflict (id) do nothing;
drop policy if exists "qiyas proofs read" on storage.objects;
create policy "qiyas proofs read" on storage.objects for select to authenticated
  using (bucket_id = 'qiyas-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.qiyas_can_write() or public.ach_all()));
drop policy if exists "qiyas proofs write" on storage.objects;
create policy "qiyas proofs write" on storage.objects for insert to authenticated
  with check (bucket_id = 'qiyas-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

-- نهاية الجزء 2
