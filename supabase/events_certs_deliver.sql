-- =====================================================================
-- شهادات الأحداث في حسابات المشاركين: زر «إصدار الشهادات إلى الحسابات» في مرحلة الشهادات يُصدر لكل حاضر
-- مستندًا في «نماذجي» بالقالب نفسه (توقيع المنظّم وختم المدرسة وتوقيع المدير)، فيراها الطالب وولي أمره،
-- والمعلم والإداري في حسابه، ويصلهم إشعار. الطباعة باقية كما هي. يُنفَّذ مرة، وتكرار تنفيذه آمن.
-- =====================================================================
insert into public.form_templates (key, title, category, orientation, allowed_roles, show_stamp, is_active, sort_order, description)
values ('event_certificate', 'شهادة حدث', 'certificate', 'landscape', '{admin,teacher}', true, false, 900,
        'تصدر من صفحة الأحداث وحدها (مرحلة الشهادات)، ولا تظهر في مكتبة النماذج.')
on conflict (key) do nothing;

-- p_items: [{pid, serial}] للطلاب، و[{key, serial, title}] للمعلمين والإدارة. p_year: السنة الهجرية.
create or replace function public.ev_issue_certs(p_event uuid, p_items jsonb, p_year int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e public.school_events; tpl uuid; sig text; stamp text; snap jsonb; it jsonb; x jsonb;
  p public.event_participants; did uuid; sr text; ruid uuid; n int := 0; ids uuid[] := '{}'; nid uuid;
begin
  if not public.ev_is_manager(p_event, array['principal', 'tech_support', 'deputy_students',
                                             'deputy_academic', 'activity_leader']) then
    raise exception 'لا تملك صلاحية هذا الحدث';
  end if;
  select * into e from public.school_events where id = p_event;
  select id into tpl from public.form_templates where key = 'event_certificate';
  if tpl is null then raise exception 'قالب شهادة الحدث غير موجود: شغّل supabase/events_certs_deliver.sql'; end if;

  -- توقيع المنظّم، أو القائد الكشفي إن نُظّم الحدث باسمه (scouts_2.sql)
  select s.sig_path into sig from public.scout_leader() s
   where s.label = e.organizer_role and s.user_id is distinct from e.organizer_id;
  if sig is null then select path into sig from public.user_signatures where user_id = e.organizer_id; end if;
  select path into stamp from public.school_assets where key = 'stamp';
  snap := to_jsonb(e) - array['audience_attended', 'audience_counts', 'report_photos', 'report_summary',
          'report_outcome', 'report_outcomes', 'report_recommendations', 'description', 'goals', 'co_organizers'];

  for it in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    did := null; ruid := null; x := null; sr := it->>'serial';
    -- رقم الشهادة من ترتيبها في الكشف؛ إن سبق لغيرها (حاضر أُضيف بعد الإصدار) يُميَّز بلاحقة
    if exists (select 1 from public.form_documents where serial = sr) then
      sr := sr || '-' || (select count(*) + 1 from public.form_documents where serial like sr || '-%');
    end if;
    if it ? 'pid' then
      select * into p from public.event_participants
       where id = (it->>'pid')::uuid and event_id = p_event and attended and cert_doc_id is null;
      if not found then continue; end if;
      select user_id into ruid from public.students where id = p.student_id;
      insert into public.form_documents (template_id, serial, title, recipient, student_id, recipient_user_id,
             signature_path, signature_name, signature_role, stamp_path, data, status, hijri_year, created_by)
      values (tpl, sr, 'شهادة: ' || e.title, p.student_name, p.student_id, ruid,
             sig, e.organizer_name, e.organizer_role, stamp,
             jsonb_build_object('event', snap, 'serial', sr, 'participant',
               jsonb_build_object('student_name', p.student_name, 'class_label', p.class_label)),
             'issued', p_year, auth.uid())
      on conflict (serial) do nothing returning id into did;
      if did is null then continue; end if;
      update public.event_participants set cert_doc_id = did, cert_issued_at = coalesce(cert_issued_at, now()) where id = p.id;
      ids := ids || ruid || array(select g.user_id from public.guardian_student gs
                                  join public.guardians g on g.id = gs.guardian_id
                                  where gs.student_id = p.student_id and g.user_id is not null);
    else
      select a into x from jsonb_array_elements(e.audience_attended) a
       where a->>'key' = it->>'key' and a->>'doc_id' is null;
      if x is null then continue; end if;
      if x->>'key' ~* '^[0-9a-f-]{36}$' then
        select id into ruid from public.users where id = (x->>'key')::uuid;
      end if;
      insert into public.form_documents (template_id, serial, title, recipient, recipient_user_id,
             signature_path, signature_name, signature_role, stamp_path, data, status, hijri_year, created_by)
      values (tpl, sr, 'شهادة: ' || e.title, x->>'name', ruid,
             sig, e.organizer_name, e.organizer_role, stamp,
             jsonb_build_object('event', snap, 'serial', sr, 'participant',
               jsonb_build_object('student_name', x->>'name', 'staff', true,
                                  'class_label', coalesce(nullif(it->>'title', ''), x->>'role'))),
             'issued', p_year, auth.uid())
      on conflict (serial) do nothing returning id into did;
      if did is null then continue; end if;
      update public.school_events set audience_attended = (
        select jsonb_agg(case when a->>'key' = x->>'key'
                              then a || jsonb_build_object('doc_id', did, 'cert_at', coalesce(a->'cert_at', to_jsonb(now())))
                              else a end)
        from jsonb_array_elements(audience_attended) a)
       where id = p_event
      returning * into e;
      ids := ids || ruid;
    end if;
    n := n + 1;
  end loop;

  ids := array(select distinct u from unnest(ids) u where u is not null);
  if cardinality(ids) > 0 then
    nid := public.send_notification('شهادة جديدة', 'صدرت لك شهادة «' || e.title || '». تجدها في «نماذجي».',
                                    'general', '/my-documents', null, ids, null, null, true);
  end if;
  return jsonb_build_object('issued', n, 'notification', nid);
end;
$$;
revoke execute on function public.ev_issue_certs(uuid, jsonb, int) from public, anon;
grant  execute on function public.ev_issue_certs(uuid, jsonb, int) to authenticated;
-- نهاية الجزء 1
