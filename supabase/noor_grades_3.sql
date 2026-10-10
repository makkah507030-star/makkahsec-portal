-- =====================================================================
-- متابعة رصد درجات الفترات في نظام نور — الجزء 3: تذكير المعلم.
-- اختبارات المعلم (الفترتان) التي حلّ موعدها ولم يسجّل الوكيل رصدها كاملًا،
-- تظهر له في «بانتظار إجرائك» للاطلاع فقط. الحالة يدخلها الوكيل وحده.
-- يُنفَّذ بعد الجزأين 1 و2، وتكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.my_noor_grade_due()
returns table (slot_id uuid, exam_date date, subject_name text, grade int, class_no int,
               status text, term_title text, deadline date)
language sql stable security definer set search_path = public as $$
  select s.id, s.exam_date, s.subject_name, c.grade, c.class_no, g.status, et.title, et.grading_deadline
    from exam_slots s
    join exam_terms et on et.id = s.exam_term_id
    join classes c on c.id = s.class_id
    join lateral (
      select sc.teacher_id from schedule sc
       where sc.id = s.schedule_id
          or (sc.class_id = s.class_id and sc.subject_id = s.subject_id
              and sc.academic_year = et.academic_year)
       order by (sc.id = s.schedule_id) desc
       limit 1) x on true
    join teachers t on t.id = x.teacher_id and t.user_id = auth.uid()
    left join noor_grade_entries g on g.exam_slot_id = s.id
   where et.kind <> 'final'
     and et.academic_year = (select value from settings where key = 'active_year')
     and s.exam_date <= (now() at time zone 'Asia/Riyadh')::date
     and s.exam_date >= (now() at time zone 'Asia/Riyadh')::date - 60
     and coalesce(g.status, '') <> 'done'
   order by s.exam_date;
$$;

grant execute on function public.my_noor_grade_due() to authenticated;

-- نهاية الجزء 3
