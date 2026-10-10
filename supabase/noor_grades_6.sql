-- =====================================================================
-- متابعة رصد الدرجات في نور — الجزء 6: مواد التقويم المستمر يحددها الوكيل.
-- المادة المعلَّمة تقويمًا مستمرًا تُعامل بلا اختبار ولو ظهر لها موعد في «جداول
-- الاختبارات» (يكون خطأً)، ويُحسب موعد رصدها من آخر يوم اختبارات في الفترة.
-- والمادة التي لا اختبار لها لأي فصل تبقى تقويمًا مستمرًا تلقائيًا.
-- يُنفَّذ بعد الأجزاء 4 و5، وتكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.noor_cont_subjects (
  subject_id uuid primary key,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.noor_cont_subjects enable row level security;

drop policy if exists noor_cont_subjects_manage on public.noor_cont_subjects;
create policy noor_cont_subjects_manage on public.noor_cont_subjects as PERMISSIVE for ALL to authenticated
  using (public.has_admin_role(array['principal', 'deputy_academic', 'tech_support']))
  with check (public.has_admin_role(array['principal', 'deputy_academic', 'tech_support']));

-- تذكير المعلم (يحل محل نسخة الجزء 5): التقويم المستمر المعلَّم يتجاهل مواعيد الجدول
drop function if exists public.my_noor_grade_due();
create function public.my_noor_grade_due()
returns table (slot_id text, exam_date date, subject_name text, grade int, class_no int,
               status text, term_title text, deadline date, cont boolean)
language sql stable security definer set search_path = public as $$
  with mine as (
    select distinct et.id as term_id, et.title, et.grading_deadline, sc.class_id, sc.subject_id,
           coalesce(et.end_date, (select max(s.exam_date) from exam_slots s where s.exam_term_id = et.id)) as last_day
      from exam_terms et
      join schedule sc on sc.academic_year = et.academic_year and sc.term = coalesce(et.term, active_term())
      join teachers t on t.id = sc.teacher_id and t.user_id = auth.uid()
     where et.kind <> 'final' and sc.subject_id is not null
       and et.academic_year = (select value from settings where key = 'active_year')),
  due as (
    select mi.*,
           exists (select 1 from noor_cont_subjects n where n.subject_id = mi.subject_id)
             or not exists (select 1 from exam_slots s where s.exam_term_id = mi.term_id
                              and s.subject_id = mi.subject_id and s.exam_date is not null) as is_cont,
           (select min(s.exam_date) from exam_slots s
             where s.exam_term_id = mi.term_id and s.class_id = mi.class_id
               and s.subject_id = mi.subject_id) as ex
      from mine mi),
  dated as (
    select d.*, case when d.is_cont then d.last_day else d.ex end as due_day from due d)
  select d.class_id::text || ':' || d.subject_id::text, d.due_day, sb.name,
         c.grade, c.class_no, m.status, d.title, d.grading_deadline, d.is_cont
    from dated d
    join classes c on c.id = d.class_id
    join subjects sb on sb.id = d.subject_id
    left join noor_grade_marks m
      on m.exam_term_id = d.term_id and m.class_id = d.class_id and m.subject_id = d.subject_id
   where coalesce(m.status, '') <> 'done' and d.due_day is not null
     and d.due_day <= (now() at time zone 'Asia/Riyadh')::date
     and d.due_day >= (now() at time zone 'Asia/Riyadh')::date - 60
   order by 2;
$$;

grant execute on function public.my_noor_grade_due() to authenticated;

-- نهاية الجزء 6
