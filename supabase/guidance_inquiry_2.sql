-- =====================================================================
-- استمارة توضيح مستوى الطالب — الجزء 2 من 3: معلمو فصل الطالب، وإنشاء الاستمارة.
-- يُنفَّذ بعد الجزء 1. تكرار التنفيذ آمن.
-- =====================================================================

-- مواد فصل الطالب ومعلموها من الجدول الدراسي للعام والفصل الدراسي النشطين
create or replace function public.guidance_class_teachers(p_student uuid)
returns table (subject text, teacher_id uuid, teacher_name text, has_account boolean)
language sql stable security definer set search_path = public as $$
  select distinct on (coalesce(sb.name, ''), t.id)
         coalesce(sb.name, '—'), t.id, t.full_name, t.user_id is not null
    from student_enrollment se
    join classes c on c.id = se.class_id
    join schedule sc on sc.class_id = se.class_id
    join teachers t on t.id = sc.teacher_id
    left join subjects sb on sb.id = sc.subject_id
   where se.student_id = p_student and se.academic_year = active_year()
     and sc.academic_year = active_year() and sc.term = active_term()
     and public.guidance_can(c.grade)
   order by coalesce(sb.name, ''), t.id;
$$;
revoke execute on function public.guidance_class_teachers(uuid) from public, anon;
grant  execute on function public.guidance_class_teachers(uuid) to authenticated;

-- p_items: [{ "subject": "...", "teacher_id": "..." }] — المعلمون الذين اختارهم الموجه
create or replace function public.guidance_inquiry_create(p_student uuid, p_flag text, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v record; nid uuid; me text; uids uuid[];
begin
  select va.student_id, va.full_name, va.grade, va.class_no into v
    from v_active_students va where va.student_id = p_student limit 1;
  if v.student_id is null then raise exception 'الطالب غير موجود في العام النشط'; end if;
  if not public.guidance_can(v.grade) then raise exception 'هذا الطالب ليس من صفك'; end if;
  if p_flag is not null and p_flag not in ('urgent', 'confidential', 'info') then raise exception 'ملصق غير معروف'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'اختر معلمًا واحدًا على الأقل'; end if;
  select full_name into me from users where id = auth.uid();

  insert into guidance_inquiries (student_id, student_name, class_label, grade, flag, counselor_name,
                                  academic_year, term)
  values (v.student_id, v.full_name,
          case v.grade when 1 then 'الأول الثانوي' when 2 then 'الثاني الثانوي' else 'الثالث الثانوي' end
            || ' — فصل ' || v.class_no,
          v.grade, p_flag, me, active_year(), active_term())
  returning id into nid;

  insert into guidance_inquiry_items (inquiry_id, subject, teacher_id, teacher_user_id, teacher_name, sort)
  select nid, coalesce(nullif(trim(e.value->>'subject'), ''), '—'), t.id, t.user_id, t.full_name, e.ordinality::int
    from jsonb_array_elements(p_items) with ordinality e
    left join teachers t on t.id = nullif(e.value->>'teacher_id', '')::uuid;

  select array_agg(distinct teacher_user_id) into uids
    from guidance_inquiry_items where inquiry_id = nid and teacher_user_id is not null;
  if uids is not null then
    perform public.send_notification(
      case p_flag when 'urgent' then 'عاجل: ' else '' end || 'استمارة مستوى طالب تنتظر تعبئتك',
      'الطالب ' || v.full_name || ' — من الموجه الطلابي. حدّد مستواه التحصيلي والسلوكي في مادتك.',
      'general', '/inquiry/' || nid, null, uids, null, null, true);
  end if;
  return nid;
end $$;
revoke execute on function public.guidance_inquiry_create(uuid, text, jsonb) from public, anon;
grant  execute on function public.guidance_inquiry_create(uuid, text, jsonb) to authenticated;
-- نهاية الجزء 2
