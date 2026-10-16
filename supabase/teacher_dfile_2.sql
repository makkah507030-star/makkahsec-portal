-- ملف المعلم الرقمي (الجزء 2 من 3): نتائج الطلاب دون أسمائهم.
-- • التقديرات: متوسط كل طالب في اختبارات المعلم هذا العام، بشرائح gradeBands.js.
-- • التحسّن: متوسط كل فصل في أول اختبار وآخره (اختباران فأكثر).
-- • الدعم العلاجي والإثرائي: من دورة الاختبار، والطالب يُحسب مرة واحدة.
-- تُستدعى من dfile_data فقط. تكرار التنفيذ آمن.

create or replace function public.dfile_grades(p_uid uuid, p_year text)
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select z.id qid, coalesce(z.exam_date, z.created_at::date) qd, sb.class_id, sb.student_id,
           100.0 * sb.score / z.total_marks pct
      from public.quizzes z join public.quiz_submissions sb on sb.quiz_id = z.id
     where z.teacher_id = p_uid and z.status <> 'draft' and coalesce(z.academic_year, p_year) = p_year
       and z.total_marks > 0 and sb.score is not null and not sb.absent and sb.class_id is not null
  ),
  st as (
    select student_id, class_id, avg(pct) a,
           case when avg(pct) >= 90 then 'b5' when avg(pct) >= 80 then 'b4' when avg(pct) >= 70 then 'b3'
                when avg(pct) >= 60 then 'b2' else 'b1' end band
      from s group by 1, 2
  ),
  cq as (  -- متوسط كل فصل في كل اختبار، مرتّبًا بالتاريخ
    select class_id, qid, qd, avg(pct) a,
           row_number() over (partition by class_id order by qd, qid) rn,
           count(*) over (partition by class_id) total
      from (select class_id, qid, qd, pct from s) x group by class_id, qid, qd
  ),
  cy as (
    select z.* from public.quizzes z
     where z.teacher_id = p_uid and coalesce(z.academic_year, p_year) = p_year and z.analyzed_at is not null
  ),
  need as (select distinct e->>'id' id from cy, jsonb_array_elements(coalesce(cy.analysis->'support', '[]')) e),
  top as (select distinct e->>'id' id, (cy.honored_at is not null or cy.cycle_closed_at is not null) h
            from cy, jsonb_array_elements(coalesce(cy.analysis->'top', '[]')) e),
  pl as (select p.* from public.quiz_plans p join cy on cy.id = p.quiz_id)
  select jsonb_build_object(
    'n', (select count(*) from st),
    'avg', (select round(avg(a)::numeric, 1) from st),
    'bands', (select coalesce(jsonb_object_agg(band, n), '{}') from (select band, count(*) n from st group by 1) b),
    'classes', (select coalesce(jsonb_agg(jsonb_build_object('label', c.class_no::text, 'bands', b.j)
                  order by c.grade, c.class_no), '[]')
                  from (select class_id, jsonb_object_agg(band, n) j
                          from (select class_id, band, count(*) n from st group by 1, 2) x group by 1) b
                  join public.classes c on c.id = b.class_id),
    'improve', (select coalesce(jsonb_agg(jsonb_build_object('label', c.class_no::text,
                  'first', round(f.a), 'last', round(l.a)) order by c.grade, c.class_no), '[]')
                  from cq f join cq l on l.class_id = f.class_id and l.rn = l.total
                  join public.classes c on c.id = f.class_id
                 where f.rn = 1 and f.total >= 2),
    'support', jsonb_build_object(
      'used', (select count(*) from cy),
      'need', (select count(*) from need),
      'planned', (select count(*) from need where id in
                   (select e->>'id' from pl, jsonb_array_elements(pl.students) e where pl.kind = 'remedial')),
      'plans', (select count(*) from pl where kind = 'remedial'),
      'plans_done', (select count(*) from pl where kind = 'remedial' and status = 'done'),
      'top', (select count(distinct id) from top),
      'honored', (select count(distinct id) from top t
                   where t.h or exists (select 1 from public.form_documents d join public.form_templates ft on ft.id = d.template_id
                                         where ft.category = 'certificate' and d.created_by = p_uid
                                           and d.student_id::text = t.id and d.status not in ('draft', 'pending', 'rejected'))),
      'enrich', (select count(*) from pl where kind = 'enrichment'))
  );
$$;

revoke execute on function public.dfile_grades(uuid, text) from public, anon;

-- الأسبوع الدراسي الحالي (من الأحد إلى الخميس) من آخر «بداية فصل» في التقويم،
-- ولا تُعدّ الأسابيع التي تغطيها إجازة كاملة. null في أسبوع الإجازة أو قبل بداية الفصل.
create or replace function public.dfile_week()
returns jsonb language sql stable security definer set search_path = public as $$
  with d as (select (now() at time zone 'Asia/Riyadh')::date today),
  t as (select max(start_date) s from public.academic_calendar, d
         where kind = 'term_start' and is_active and start_date <= d.today),
  w as (select g::date sun from t, d,
          generate_series(t.s - extract(dow from t.s)::int, d.today, interval '7 days') g),
  wk as (select sun, not exists (select 1 from public.academic_calendar h
                                  where h.kind = 'holiday' and h.is_active and h.start_date <= w.sun
                                    and coalesce(h.end_date, h.start_date) >= w.sun + 4) study
           from w),
  cur as (select max(sun) sun from wk)
  select case when (select study from wk where sun = cur.sun)
              then jsonb_build_object('n', (select count(*) from wk where study and sun <= cur.sun),
                                      'from', cur.sun, 'to', cur.sun + 4) end
    from cur;
$$;
-- نهاية الجزء 2
