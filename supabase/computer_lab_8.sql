-- =====================================================================
-- معمل الحاسب الآلي (8): رصد درجة الطالب من رمز QR في ملف الحصة، ونتائج الحصة.
-- يُنفَّذ بعد الجزء 7. تكرار التنفيذ آمن.
-- نص الرمز: [رابط/]MKL1.الرمز.الجهاز.أرقام-الطلاب.الاختبار.الإتقان.المنجز.المحطات.التوقيع
-- التوقيع: أول 16 حرفًا من HMAC-SHA256 لما قبله بمفتاح الحصة. و x = لم يُنجز.
-- =====================================================================
create or replace function public.lab_result_record(p_text text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  t text := regexp_replace(trim(coalesce(p_text, '')), '^.*/', '');
  p text[] := string_to_array(t, '.');
  s public.lab_sessions;
  v_idx text; v_sid uuid; v_seat integer; v_new boolean;
  out jsonb := '[]';
begin
  if not (public.lab_can_book() or public.lab_is_manager()) then raise exception 'غير مخوّل برصد درجات المعمل'; end if;
  if coalesce(array_length(p, 1), 0) <> 9 or p[1] <> 'MKL1' then raise exception 'ليس رمز درجة من ملف المعمل'; end if;
  select * into s from public.lab_sessions where code = p[2];
  if s.id is null then raise exception 'الحصة غير موجودة (قد تكون حُذفت)'; end if;
  if lower(p[9]) <> left(encode(hmac(array_to_string(p[1:8], '.'), s.secret, 'sha256'), 'hex'), 16) then
    raise exception 'رمز غير صحيح: التوقيع لا يطابق';
  end if;
  foreach v_idx in array string_to_array(p[4], '-') loop
    v_sid := (s.roster ->> (v_idx::int))::uuid;
    continue when v_sid is null;
    select seat_no into v_seat from public.lab_seats where lab_id = s.lab_id and class_id = s.class_id and student_id = v_sid;
    insert into public.lab_results (session_id, student_id, device_seat, map_seat, quiz, mastery, done, total)
    values (s.id, v_sid, p[3]::int, v_seat, nullif(p[5], 'x')::int, nullif(p[6], 'x')::int, p[7]::int, p[8]::int)
    on conflict do nothing;
    v_new := found;
    out := out || jsonb_build_object('name', (select full_name from public.students where id = v_sid),
                                     'map_seat', v_seat, 'new', v_new);
  end loop;
  return jsonb_build_object('session', s.id, 'lesson', s.lesson_title,
    'class_no', (select class_no from public.classes where id = s.class_id),
    'device', p[3]::int, 'quiz', nullif(p[5], 'x')::int, 'mastery', nullif(p[6], 'x')::int,
    'done', p[7]::int, 'total', p[8]::int, 'students', out);
end $$;

-- كل طلاب الحصة ونتائجهم (الفارغ لمن لم تُرصد درجته)
create or replace function public.lab_session_results(p_session uuid)
returns table (student_id uuid, full_name text, map_seat integer, device_seat integer, quiz integer,
               mastery integer, done integer, total integer, scanned_at timestamptz)
language sql stable security definer set search_path = public as $$
  select st.id, st.full_name, coalesce(r.map_seat, ls.seat_no), r.device_seat, r.quiz, r.mastery, r.done, r.total, r.scanned_at
    from public.lab_sessions s
    cross join lateral jsonb_array_elements_text(s.roster) x(id)
    join public.students st on st.id = x.id::uuid
    left join public.lab_results r on r.session_id = s.id and r.student_id = st.id
    left join public.lab_seats ls on ls.lab_id = s.lab_id and ls.class_id = s.class_id and ls.student_id = st.id
   where s.id = p_session and (s.created_by = auth.uid() or public.lab_is_manager())
   order by st.full_name;
$$;

-- حذف درجة طالب لإعادة رصدها (مسح خاطئ)
create or replace function public.lab_result_delete(p_session uuid, p_student uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.lab_results r using public.lab_sessions s
   where r.session_id = p_session and r.student_id = p_student and s.id = r.session_id
     and (s.created_by = auth.uid() or public.lab_is_manager());
$$;
-- نهاية الجزء 8
