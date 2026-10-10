-- =====================================================================
-- متابعة رصد درجات الفترات في نظام نور — الجزء 2 من 2: لوحة المتابعة.
-- كل اختبار فترة لفصل ومادة، مع معلمه من الجدول الدراسي وحالة رصده.
-- للمدير ووكيل الشؤون التعليمية والدعم الفني فقط.
-- يُنفَّذ بعد الجزء 1، وتكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.noor_grade_board(p_term uuid)
returns table (slot_id uuid, exam_date date, subject_name text, grade int, class_no int,
               teacher_id uuid, teacher_name text, status text, note text,
               updated_name text, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_admin_role(array['principal', 'deputy_academic', 'tech_support']) then
    raise exception 'غير مصرح';
  end if;
  return query
  select s.id, s.exam_date, s.subject_name, c.grade, c.class_no,
         t.id, t.full_name, g.status, g.note, g.updated_name, g.updated_at
    from exam_slots s
    join exam_terms et on et.id = s.exam_term_id
    join classes c on c.id = s.class_id
    -- المعلم: من حصة الجدول التي اختيرت منها الخانة، وإلا من الفصل والمادة في العام نفسه
    left join lateral (
      select sc.teacher_id from schedule sc
       where sc.id = s.schedule_id
          or (sc.class_id = s.class_id and sc.subject_id = s.subject_id
              and sc.academic_year = et.academic_year)
       order by (sc.id = s.schedule_id) desc
       limit 1) x on true
    left join teachers t on t.id = x.teacher_id
    left join noor_grade_entries g on g.exam_slot_id = s.id
   where s.exam_term_id = p_term and s.class_id is not null and et.kind <> 'final';
end;
$$;

grant execute on function public.noor_grade_board(uuid) to authenticated;

-- نهاية الجزء 2
