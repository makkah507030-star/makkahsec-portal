-- =====================================================================
-- معمل الحاسب الآلي (12): رصد الدرجة من ملف الحصة (MKL1) ومن الملف الدائم (MKL2).
-- يحل محل lab_result_record في الجزء 8. يُنفَّذ بعد الجزء 11. تكرار التنفيذ آمن.
--   MKL1.رمز الحصة.الجهاز.الطلاب.الاختبار.الإتقان.المنجز.المحطات.التوقيع
--   MKL2.رمز الملف.التاريخ.رقم الفصل.الدرس.الجهاز.الطلاب.الاختبار.الإتقان.المنجز.المحطات.التوقيع
-- التوقيع: أول 16 حرفًا من HMAC-SHA256 لما قبله بمفتاح الحصة أو الملف. و x = لم يُنجز.
-- =====================================================================
create or replace function public.lab_result_record(p_text text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  t text := regexp_replace(trim(coalesce(p_text, '')), '^.*/', '');
  p text[] := string_to_array(t, '.');
  n integer := coalesce(array_length(string_to_array(t, '.'), 1), 0);
  s public.lab_sessions; i public.lab_installs;
  f text[];                                   -- الجهاز، الطلاب، الاختبار، الإتقان، المنجز، المحطات
  v_day date; v_idx text; v_sid uuid; v_seat integer; v_new boolean;
  out jsonb := '[]';
begin
  if not (public.lab_can_book() or public.lab_is_manager()) then raise exception 'غير مخوّل برصد درجات المعمل'; end if;
  if p[1] = 'MKL1' and n = 9 then
    select * into s from public.lab_sessions where code = p[2];
    if s.id is null then raise exception 'الحصة غير موجودة (قد تكون حُذفت)'; end if;
    if lower(p[9]) <> left(encode(hmac(array_to_string(p[1:8], '.'), s.secret, 'sha256'), 'hex'), 16) then
      raise exception 'رمز غير صحيح: التوقيع لا يطابق';
    end if;
    f := p[3:8];
  elsif p[1] = 'MKL2' and n = 12 then
    select * into i from public.lab_installs where code = p[2];
    if i.id is null then raise exception 'ملف المعمل غير معروف (قد يكون قديمًا)'; end if;
    if lower(p[12]) <> left(encode(hmac(array_to_string(p[1:11], '.'), i.secret, 'sha256'), 'hex'), 16) then
      raise exception 'رمز غير صحيح: التوقيع لا يطابق';
    end if;
    v_day := to_date(p[3], 'YYYYMMDD');
    if i.classes -> (p[4]::int) is null then raise exception 'الفصل غير موجود في ملف المعمل'; end if;
    select * into s from public.lab_sessions
     where install_id = i.id and class_idx = p[4]::int and lesson_id = p[5] and room_date = v_day;
    if s.id is null then   -- حصة لم يفتحها هذا المعلم من البوابة: تُنشأ عند أول رصد
      insert into public.lab_sessions (code, lab_id, class_id, lesson_id, lesson_title, secret, roster, install_id, room_date, class_idx)
      values (upper(substr(md5(gen_random_uuid()::text), 1, 8)), i.lab_id, (i.classes -> (p[4]::int) ->> 'class_id')::uuid,
              p[5], p[5], i.secret, i.classes -> (p[4]::int) -> 'students', i.id, v_day, p[4]::int)
      returning * into s;
    end if;
    f := p[6:11];
  else
    raise exception 'ليس رمز درجة من ملف المعمل';
  end if;

  foreach v_idx in array string_to_array(f[2], '-') loop
    v_sid := (s.roster ->> (v_idx::int))::uuid;
    continue when v_sid is null;
    select seat_no into v_seat from public.lab_seats where lab_id = s.lab_id and class_id = s.class_id and student_id = v_sid;
    insert into public.lab_results (session_id, student_id, device_seat, map_seat, quiz, mastery, done, total)
    values (s.id, v_sid, f[1]::int, v_seat, nullif(f[3], 'x')::int, nullif(f[4], 'x')::int, f[5]::int, f[6]::int)
    on conflict do nothing;
    v_new := found;
    out := out || jsonb_build_object('name', (select full_name from public.students where id = v_sid), 'map_seat', v_seat, 'new', v_new);
  end loop;
  return jsonb_build_object('session', s.id, 'lesson', s.lesson_title,
    'class_no', (select class_no from public.classes where id = s.class_id),
    'device', f[1]::int, 'quiz', nullif(f[3], 'x')::int, 'mastery', nullif(f[4], 'x')::int,
    'done', f[5]::int, 'total', f[6]::int, 'students', out);
end $$;
-- نهاية الجزء 12
