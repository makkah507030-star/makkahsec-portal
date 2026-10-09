-- =====================================================================
-- التطوير المهني (الجزء 4 من 4): الرقم، والرفع للاعتماد، والاعتماد،
-- وملاحظة المدير، وإضافة الجلسة المعتمدة إلى سجل التطوير المهني (2-6)
-- لرئيس القسم ولكل من وقّع. يُنفَّذ بعد الجزء 3. تكرار التنفيذ آمن.
-- =====================================================================

alter table public.perf_evidence add column if not exists plc_session_id uuid
  references public.plc_sessions(id) on delete cascade;
alter table public.perf_evidence drop constraint if exists perf_evidence_source_check;
alter table public.perf_evidence add constraint perf_evidence_source_check check (source in ('upload', 'form', 'plc'));

-- الرقم: PLC-العام-التسلسل
create or replace function public.plc_serial()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.serial := 'PLC-' || coalesce(new.academic_year, '') || '-' ||
    lpad((select count(*) + 1 from plc_sessions where academic_year is not distinct from new.academic_year)::text, 4, '0');
  return new;
end;
$$;
drop trigger if exists plc_serial on public.plc_sessions;
create trigger plc_serial before insert on public.plc_sessions for each row execute function public.plc_serial();

-- رئيس القسم يرفعها للاعتماد بعد توقيع الحاضرين كلهم
create or replace function public.plc_submit(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s plc_sessions;
begin
  select * into s from plc_sessions where id = p_id;
  if s.head_user_id is distinct from auth.uid() or s.status <> 'signing' then raise exception 'غير مصرّح'; end if;
  if exists (select 1 from jsonb_array_elements(s.attendees) a
              where not exists (select 1 from plc_signatures g
                                 where g.session_id = p_id and g.user_id = (a->>'user_id')::uuid)) then
    raise exception 'لم يوقّع الحاضرون كلهم بعد';
  end if;
  update plc_sessions set status = 'pending', submitted_at = now(), updated_at = now() where id = p_id;
end;
$$;

-- وكيل الشؤون التعليمية (أو الدعم الفني) يعتمد أو يعيد بملاحظة
create or replace function public.plc_decide(p_id uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare s plc_sessions; v_name text; d text;
begin
  if not has_admin_role(array['deputy_academic', 'tech_support']) then raise exception 'غير مصرّح'; end if;
  select * into s from plc_sessions where id = p_id;
  if s.status <> 'pending' then raise exception 'الجلسة ليست بانتظار الاعتماد'; end if;
  if not p_approve and coalesce(trim(p_note), '') = '' then raise exception 'اكتب ملاحظة الإعادة'; end if;
  select full_name into v_name from users where id = auth.uid();
  update plc_sessions set status = case when p_approve then 'approved' else 'returned' end,
         decided_by = auth.uid(), decided_name = v_name, decided_at = now(),
         decision_note = nullif(trim(p_note), ''), updated_at = now()
   where id = p_id;
  if not p_approve then return; end if;

  select name into d from departments where id = s.department_id;
  insert into perf_evidence (teacher_user_id, academic_year, item_key, source, title, provider, event_date, plc_session_id)
  select u.uid, coalesce(s.academic_year, ''), 'e02_06', 'plc',
         'جلسة مجتمع التعلم المهني: ' || coalesce(s.data->>'topic', ''), 'قسم ' || d,
         nullif(s.data->>'date', '')::date, p_id
    from (select s.head_user_id as uid
          union select g.user_id from plc_signatures g where g.session_id = p_id) u
   where not exists (select 1 from perf_evidence e where e.plc_session_id = p_id and e.teacher_user_id = u.uid);
end;
$$;

-- مدير المدرسة: ملاحظة أو توجيه أو تغذية راجعة
create or replace function public.plc_principal_note(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_admin_role(array['principal', 'tech_support']) then raise exception 'غير مصرّح'; end if;
  update plc_sessions set principal_note = nullif(trim(p_note), ''), principal_at = now(),
         principal_name = (select full_name from users where id = auth.uid()), updated_at = now()
   where id = p_id;
end;
$$;

revoke execute on function public.plc_submit(uuid) from public, anon;
revoke execute on function public.plc_decide(uuid, boolean, text) from public, anon;
revoke execute on function public.plc_principal_note(uuid, text) from public, anon;
grant execute on function public.plc_submit(uuid) to authenticated;
grant execute on function public.plc_decide(uuid, boolean, text) to authenticated;
grant execute on function public.plc_principal_note(uuid, text) to authenticated;
-- نهاية الجزء 4
