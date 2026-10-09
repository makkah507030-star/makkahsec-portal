-- =====================================================================
-- التطوير المهني (الجزء 7 من 7): إجراءات الزيارة التبادلية.
-- • xv_host_sign: المستضيف يكتب تعقيبه ويوقّع، فتنتقل للاعتماد.
-- • xv_decide: وكيل الشؤون التعليمية (أو الدعم الفني) يعتمد أو يعيد بملاحظة،
--   والمعتمدة تُضاف للمستضيف في 2-3 «تنفيذ زيارات تبادلية» وللزائر في 2-4
--   «حضور الزيارات التبادلية».
-- • xv_principal_note: ملاحظة مدير المدرسة.
-- يُنفَّذ بعد الجزء 6. تكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.xv_host_sign(p_id uuid, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update exchange_visits
     set host_comment = nullif(trim(p_comment), ''), host_signed_at = now(), status = 'pending', updated_at = now()
   where id = p_id and host_user_id = auth.uid() and status = 'hosting';
  if not found then raise exception 'الزيارة ليست بانتظار توقيعك'; end if;
end;
$$;

create or replace function public.xv_decide(p_id uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v exchange_visits; v_name text; d text;
begin
  if not has_admin_role(array['deputy_academic', 'tech_support']) then raise exception 'غير مصرّح'; end if;
  select * into v from exchange_visits where id = p_id;
  if v.status <> 'pending' then raise exception 'الزيارة ليست بانتظار الاعتماد'; end if;
  if not p_approve and coalesce(trim(p_note), '') = '' then raise exception 'اكتب ملاحظة الإعادة'; end if;
  select full_name into v_name from users where id = auth.uid();
  update exchange_visits set status = case when p_approve then 'approved' else 'returned' end,
         decided_by = auth.uid(), decided_name = v_name, decided_at = now(),
         decision_note = nullif(trim(p_note), ''), updated_at = now(),
         host_signed_at = case when p_approve then host_signed_at end   -- المُعادة يوقّعها المستضيف من جديد
   where id = p_id;
  if not p_approve then return; end if;

  select name into d from departments where id = v.department_id;
  insert into perf_evidence (teacher_user_id, academic_year, item_key, source, title, provider, event_date, xvisit_id)
  select x.uid, coalesce(v.academic_year, ''), x.item, 'xvisit', x.title, 'قسم ' || d,
         nullif(v.data->>'date', '')::date, p_id
    from (values (v.host_user_id, 'e02_03', 'زيارة تبادلية: استضافة ' || coalesce(v.visitor_name, '') ||
                  ' في درس ' || coalesce(v.data->>'lesson', '')),
                 (v.visitor_user_id, 'e02_04', 'زيارة تبادلية: حضور درس ' || coalesce(v.host_name, '') ||
                  ' — ' || coalesce(v.data->>'lesson', ''))) as x(uid, item, title)
   where not exists (select 1 from perf_evidence e where e.xvisit_id = p_id and e.teacher_user_id = x.uid);
end;
$$;

create or replace function public.xv_principal_note(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_admin_role(array['principal', 'tech_support']) then raise exception 'غير مصرّح'; end if;
  update exchange_visits set principal_note = nullif(trim(p_note), ''), principal_at = now(),
         principal_name = (select full_name from users where id = auth.uid()), updated_at = now()
   where id = p_id;
end;
$$;

revoke execute on function public.xv_host_sign(uuid, text) from public, anon;
revoke execute on function public.xv_decide(uuid, boolean, text) from public, anon;
revoke execute on function public.xv_principal_note(uuid, text) from public, anon;
grant execute on function public.xv_host_sign(uuid, text) to authenticated;
grant execute on function public.xv_decide(uuid, boolean, text) to authenticated;
grant execute on function public.xv_principal_note(uuid, text) to authenticated;
-- نهاية الجزء 7
