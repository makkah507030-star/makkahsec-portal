-- =====================================================================
-- التطوير المهني: نماذج أنشطة «دليل اعتماد وتنفيذ أنشطة التطوير المهني التعليمي» كلها،
-- وبند كل نشاط في سجل الأداء الوظيفي بعد اعتماده:
--   2-1 تنفيذ برنامج · 2-2 حضور برنامج، والقراءة الموجهة، والزيارة الميدانية، وحاضرو البرنامج
--   والورشة والدرس التطبيقي · 2-5 المؤتمر والمحاضرة والندوة واللقاء التربوي · 2-6 دورة بحث الدرس
--   (للمنفّذ والفريق) · 2-7 الدرس التطبيقي وورشة العمل · 2-8 الورقة العلمية والمؤلفات والبحث الإجرائي
-- يُنفَّذ بعد plc_9_pd_actions.sql. تكرار التنفيذ آمن.
-- =====================================================================
alter table public.pd_reports drop constraint if exists pd_reports_kind_check;
alter table public.pd_reports add constraint pd_reports_kind_check check (kind in (
  'training', 'applied', 'attend', 'conference', 'production', 'workshop', 'lesson_study', 'reading',
  'lecture', 'seminar', 'edu_meeting', 'paper', 'books', 'research', 'field_visit'));

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

revoke execute on function public.pd_decide(uuid, boolean, text) from public, anon;
grant execute on function public.pd_decide(uuid, boolean, text) to authenticated;
-- نهاية الجزء 1
