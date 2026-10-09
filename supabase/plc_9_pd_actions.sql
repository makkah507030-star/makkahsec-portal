-- =====================================================================
-- التطوير المهني (الجزء 9 من 9): الرقم، والرفع، والاعتماد، وملاحظة المدير
-- لنماذج pd_reports، وإضافة المعتمد إلى سجل التطوير المهني:
--   training → 2-1 لصاحبه و2-2 لمن وقّع · applied → 2-7 لصاحبه و2-2 لمن وقّع
--   attend → 2-2 · conference → 2-5 · production → 2-8
-- يُنفَّذ بعد الجزء 8. تكرار التنفيذ آمن.
-- =====================================================================

alter table public.perf_evidence add column if not exists pd_report_id uuid
  references public.pd_reports(id) on delete cascade;
alter table public.perf_evidence drop constraint if exists perf_evidence_source_check;
alter table public.perf_evidence add constraint perf_evidence_source_check
  check (source in ('upload', 'form', 'plc', 'xvisit', 'pd'));

create or replace function public.pd_serial()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.serial := 'PD-' || coalesce(new.academic_year, '') || '-' ||
    lpad((select count(*) + 1 from pd_reports where academic_year is not distinct from new.academic_year)::text, 4, '0');
  return new;
end;
$$;
drop trigger if exists pd_serial on public.pd_reports;
create trigger pd_serial before insert on public.pd_reports for each row execute function public.pd_serial();

-- صاحب النموذج يرفعه للاعتماد (بعد توقيع الحاضرين كلهم إن وُجدوا)
create or replace function public.pd_submit(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r pd_reports;
begin
  select * into r from pd_reports where id = p_id;
  if r.owner_user_id is distinct from auth.uid() or r.status not in ('draft', 'signing', 'returned') then
    raise exception 'غير مصرّح';
  end if;
  if exists (select 1 from jsonb_array_elements(r.attendees) a
              where not exists (select 1 from pd_signatures g where g.report_id = p_id and g.user_id = (a->>'user_id')::uuid)) then
    raise exception 'لم يوقّع الحاضرون كلهم بعد';
  end if;
  update pd_reports set status = 'pending', submitted_at = now(), updated_at = now() where id = p_id;
end;
$$;

create or replace function public.pd_decide(p_id uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare r pd_reports; v_name text; own_item text; att_item text; t text;
begin
  if not has_admin_role(array['deputy_academic', 'tech_support']) then raise exception 'غير مصرّح'; end if;
  select * into r from pd_reports where id = p_id;
  if r.status <> 'pending' then raise exception 'النموذج ليس بانتظار الاعتماد'; end if;
  if not p_approve and coalesce(trim(p_note), '') = '' then raise exception 'اكتب ملاحظة الإعادة'; end if;
  select full_name into v_name from users where id = auth.uid();
  update pd_reports set status = case when p_approve then 'approved' else 'returned' end,
         decided_by = auth.uid(), decided_name = v_name, decided_at = now(),
         decision_note = nullif(trim(p_note), ''), updated_at = now()
   where id = p_id;
  if not p_approve then return; end if;

  own_item := case r.kind when 'training' then 'e02_01' when 'applied' then 'e02_07' when 'attend' then 'e02_02'
                          when 'conference' then 'e02_05' else 'e02_08' end;
  att_item := case when r.kind in ('training', 'applied') then 'e02_02' end;
  t := coalesce(r.data->>'title', '');
  insert into perf_evidence (teacher_user_id, academic_year, item_key, source, title, provider, event_date, hours, pd_report_id)
  select x.uid, coalesce(r.academic_year, ''), x.item, 'pd', x.title, nullif(r.data->>'provider', ''),
         nullif(r.data->>'date', '')::date, nullif(r.data->>'hours', '')::numeric, p_id
    from (select r.owner_user_id as uid, own_item as item, t as title
          union all
          select g.user_id, att_item, 'حضور: ' || t || ' — ' || coalesce(r.owner_name, '')
            from pd_signatures g where g.report_id = p_id and att_item is not null) x
   where not exists (select 1 from perf_evidence e where e.pd_report_id = p_id and e.teacher_user_id = x.uid);
end;
$$;

create or replace function public.pd_principal_note(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_admin_role(array['principal', 'tech_support']) then raise exception 'غير مصرّح'; end if;
  update pd_reports set principal_note = nullif(trim(p_note), ''), principal_at = now(),
         principal_name = (select full_name from users where id = auth.uid()), updated_at = now()
   where id = p_id;
end;
$$;

revoke execute on function public.pd_submit(uuid) from public, anon;
revoke execute on function public.pd_decide(uuid, boolean, text) from public, anon;
revoke execute on function public.pd_principal_note(uuid, text) from public, anon;
grant execute on function public.pd_submit(uuid) to authenticated;
grant execute on function public.pd_decide(uuid, boolean, text) to authenticated;
grant execute on function public.pd_principal_note(uuid, text) to authenticated;
-- نهاية الجزء 9
