-- =====================================================================
-- متابعة رصد الدرجات في نور — الجزء 5: لوحة المتابعة وتذكير المعلم من الجدول الدراسي.
-- كل فصل ومادة في الجدول الدراسي للفترة (العام والفصل الدراسي)، مع معلميه،
-- وموعد اختباره من «جداول الاختبارات» إن وُجد، وحالة رصده.
-- يُنفَّذ بعد الجزء 4، وتكرار التنفيذ آمن.
-- =====================================================================

-- اسم جديد حتى لا تتعطل الصفحة المنشورة قبل نشر الكود الجديد (القديمة noor_grade_board)
create or replace function public.noor_grade_matrix(p_term uuid)
returns table (slot_id text, class_id uuid, subject_id uuid, exam_date date, subject_name text,
               grade int, class_no int, teacher_id uuid, teacher_name text,
               status text, note text, updated_name text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  with cs as (
    select sc.class_id, sc.subject_id, et.id as term_id,
           (array_agg(sc.teacher_id order by sc.teacher_id))[1] as tid,
           string_agg(distinct t.full_name, '، ') as tnames
      from exam_terms et
      join schedule sc on sc.academic_year = et.academic_year and sc.term = coalesce(et.term, active_term())
      left join teachers t on t.id = sc.teacher_id
     where et.id = p_term and et.kind <> 'final' and sc.subject_id is not null
     group by sc.class_id, sc.subject_id, et.id)
  select cs.class_id::text || ':' || cs.subject_id::text, cs.class_id, cs.subject_id,
         (select min(s.exam_date) from exam_slots s
           where s.exam_term_id = cs.term_id and s.class_id = cs.class_id and s.subject_id = cs.subject_id),
         sb.name, c.grade, c.class_no, cs.tid, cs.tnames, m.status, m.note, m.updated_name, m.updated_at
    from cs
    join classes c on c.id = cs.class_id
    join subjects sb on sb.id = cs.subject_id
    left join noor_grade_marks m
      on m.exam_term_id = cs.term_id and m.class_id = cs.class_id and m.subject_id = cs.subject_id
   where has_admin_role(array['principal', 'deputy_academic', 'tech_support']);
$$;

grant execute on function public.noor_grade_matrix(uuid) to authenticated;

-- تذكير المعلم my_noor_grade_due: نسخته في noor_grades_6.sql (مع مواد التقويم المستمر).

-- نهاية الجزء 5
