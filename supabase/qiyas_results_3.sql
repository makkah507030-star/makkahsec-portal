-- =====================================================================
-- نتائج قياس — الجزء 3: إثبات الدرجة مطلوب من الطالب. qiyas_submit ترفض نتيجة الطالب بلا صورة
-- النتيجة من حسابه في قياس (أو بلا صورة سابقة لنتيجته في المحاولة نفسها عند تعديلها).
-- يستبدل الدالة من qiyas_results_2.sql، ويُنفَّذ بعده. تكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.qiyas_submit(p_test text, p_attempt text, p_score numeric, p_taken_on date, p_proof text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_sid uuid; v_id uuid; v_year text;
begin
  select id into v_sid from students where user_id = auth.uid() limit 1;
  if v_sid is null then raise exception 'هذه الخدمة للطالب من حسابه'; end if;
  if p_test not in ('qudrat', 'tahsili', 'step') or p_score is null or p_score < 0 or p_score > 100 then raise exception 'بيانات غير صالحة'; end if;
  if p_proof is not null and p_proof not like auth.uid()::text || '/%' then raise exception 'ملف الإثبات غير صالح'; end if;
  -- الإثبات مطلوب: ملف جديد، أو ملف سابق لنتيجته في المحاولة نفسها عند تعديلها
  if p_proof is null and not exists (select 1 from qiyas_results where student_id = v_sid and test = p_test
       and attempt = coalesce(nullif(trim(p_attempt), ''), 'المحاولة الأولى') and source = 'student' and proof_path is not null) then
    raise exception 'أرفق صورة النتيجة من حسابك في قياس إثباتًا للدرجة';
  end if;
  select value into v_year from settings where key = 'active_year';
  insert into qiyas_results (student_id, test, attempt, score, taken_on, academic_year, source, status, proof_path, uploader_name)
  values (v_sid, p_test, coalesce(nullif(trim(p_attempt), ''), 'المحاولة الأولى'), p_score, p_taken_on, coalesce(v_year, ''),
          'student', 'verified', p_proof, (select full_name from users where id = auth.uid()))
  on conflict (student_id, test, attempt) do update set score = excluded.score, taken_on = excluded.taken_on,
    proof_path = coalesce(excluded.proof_path, qiyas_results.proof_path), status = 'verified', source = 'student',
    reject_reason = null, verified_by_name = null, verified_at = null, updated_at = now()
    where qiyas_results.source = 'student'
  returning id into v_id;
  if v_id is null then raise exception 'نتيجتك في هذه المحاولة مسجّلة رسميًا من تقرير المركز'; end if;
  return v_id;
end $$;
revoke all on function public.qiyas_submit(text, text, numeric, date, text) from public, anon;
grant execute on function public.qiyas_submit(text, text, numeric, date, text) to authenticated;

-- نهاية الجزء 1
