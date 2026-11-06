-- =====================================================================
-- نماذج التطوير المهني — منع الشواهد الصورية (2 من 2): شروط الرفع، والاعتماد، وإلغاؤه.
-- • لا يُرفع نموذج بلا مرفق شاهد، ولا نشاط خارجي لا يُعتمد في المدرسة (تنفيذ برنامج تدريبي،
--   والبحث الإجرائي، والزيارة الميدانية)، ولا ورشة أو درس تطبيقي أو بحث درس بلا خطة موافق عليها قبل تنفيذه.
-- • pd_revoke: إلغاء اعتماد نموذج ثبت أنه صوري، بملاحظة، فيسقط شاهده من سجل الأداء لصاحبه وللموقّعين.
-- يُنفَّذ بعد الجزء 1. تكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.pd_submit(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r pd_reports;
begin
  select * into r from pd_reports where id = p_id;
  if r.owner_user_id is distinct from auth.uid() or r.status not in ('draft', 'signing', 'returned') then raise exception 'غير مصرّح'; end if;
  if r.kind in ('training', 'research', 'field_visit') then raise exception 'هذا النشاط يعتمده المعهد أو اللجنة المختصة في الإدارة، ولا يُوثَّق في البوابة'; end if;
  if jsonb_array_length(coalesce(r.files, '[]'::jsonb)) = 0 then raise exception 'أرفق شاهدًا واحدًا على الأقل (شهادة أو صور التنفيذ أو الخطة)'; end if;
  if r.kind in ('workshop', 'applied', 'lesson_study') then
    if r.plan_approved_at is null then raise exception 'لم يُوافَق على خطة النشاط قبل تنفيذه'; end if;
    if coalesce(r.data->>'date', '') = '' or (r.data->>'date')::date < r.plan_approved_at::date then
      raise exception 'تاريخ التنفيذ قبل الموافقة على الخطة';
    end if;
  end if;
  if exists (select 1 from jsonb_array_elements(r.attendees) a
              where not exists (select 1 from pd_signatures g where g.report_id = p_id and g.user_id = (a->>'user_id')::uuid)) then
    raise exception 'لم يوقّع الحاضرون كلهم بعد';
  end if;
  perform set_config('pd.allow', '1', true);
  update pd_reports set status = 'pending', submitted_at = now(), updated_at = now() where id = p_id;
end $$;

create or replace function public.pd_decide(p_id uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare r pd_reports; v_name text; own_item text; att_item text; t text;
begin
  if not has_admin_role(array['deputy_academic', 'tech_support']) then raise exception 'غير مصرّح'; end if;
  select * into r from pd_reports where id = p_id;
  if r.status <> 'pending' then raise exception 'النموذج ليس بانتظار الاعتماد'; end if;
  if not p_approve and coalesce(trim(p_note), '') = '' then raise exception 'اكتب ملاحظة الإعادة'; end if;
  select full_name into v_name from users where id = auth.uid();
  perform set_config('pd.allow', '1', true);
  update pd_reports set status = case when p_approve then 'approved' else 'returned' end,
         decided_by = auth.uid(), decided_name = v_name, decided_at = now(),
         decision_note = nullif(trim(p_note), ''), updated_at = now()
   where id = p_id;
  if not p_approve then return; end if;
  -- البند في سجل الأداء: لصاحب النموذج، وللحاضرين الموقّعين
  own_item := case
    when r.kind = 'training' then 'e02_01'
    when r.kind in ('attend', 'reading', 'field_visit') then 'e02_02'
    when r.kind in ('conference', 'lecture', 'seminar', 'edu_meeting') then 'e02_05'
    when r.kind = 'lesson_study' then 'e02_06'
    when r.kind in ('applied', 'workshop') then 'e02_07'
    else 'e02_08' end;
  att_item := case when r.kind in ('training', 'applied', 'workshop') then 'e02_02'
                   when r.kind = 'lesson_study' then 'e02_06' end;
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

-- إلغاء اعتماد نموذج ثبت أنه صوري (وكيل الشؤون التعليمية والمدير والدعم الفني)
create or replace function public.pd_revoke(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_admin_role(array['deputy_academic', 'principal', 'tech_support']) then raise exception 'غير مصرّح'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'اكتب سبب إلغاء الاعتماد'; end if;
  perform set_config('pd.allow', '1', true);
  update pd_reports set status = 'revoked', decision_note = trim(p_note), decided_by = auth.uid(),
         decided_name = (select full_name from users where id = auth.uid()), decided_at = now(), updated_at = now()
   where id = p_id and status = 'approved';
  if not found then raise exception 'النموذج ليس معتمدًا'; end if;
  delete from perf_evidence where pd_report_id = p_id;
end $$;

revoke execute on function public.pd_submit(uuid), public.pd_decide(uuid, boolean, text), public.pd_revoke(uuid, text) from public, anon;
grant execute on function public.pd_submit(uuid), public.pd_decide(uuid, boolean, text), public.pd_revoke(uuid, text) to authenticated;
-- نهاية الجزء 2
