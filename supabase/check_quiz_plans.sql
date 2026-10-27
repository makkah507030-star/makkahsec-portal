-- =====================================================================
-- قراءة فقط: لماذا تضم الخطة العلاجية متفوقين ولا تضم المتعثرين؟
-- لكل اختبار اعتُمد تحليله: الدرجة الكلية المسجّلة ومجموع درجات أسئلته، وعدد من هم
-- دون 60% وفوق 90% الآن، وما حُفظ في التحليل المعتمد، وطلاب الخطة العلاجية ونسبهم المحفوظة.
-- يُنفَّذ في Supabase ← SQL Editor.
-- =====================================================================
with s as (
  select qs.quiz_id,
         count(*) filter (where not qs.absent and qs.score is not null) as graded,
         count(*) filter (where not qs.absent and qs.score is not null
                            and qs.score / nullif(q.total_marks, 0) < 0.6) as below60,
         count(*) filter (where not qs.absent and qs.score is not null
                            and qs.score / nullif(q.total_marks, 0) >= 0.9) as top90,
         max(qs.score) as max_score
    from public.quiz_submissions qs join public.quizzes q on q.id = qs.quiz_id
   group by qs.quiz_id
)
select q.title as "الاختبار",
       coalesce(t.full_name, '—') as "المعلم",
       q.period as "الفترة", q.mode as "النوع",
       q.total_marks as "الدرجة الكلية",
       (select sum(marks) from public.quiz_questions qq where qq.quiz_id = q.id) as "مجموع درجات الأسئلة",
       s.max_score as "أعلى درجة مرصودة",
       s.graded || ' مرصود · ' || s.below60 || ' دون 60% · ' || s.top90 || ' فوق 90%' as "الآن",
       coalesce(q.analysis->>'graded', '?') || ' مرصود · '
         || jsonb_array_length(coalesce(q.analysis->'support', '[]')) || ' دون 60% · '
         || jsonb_array_length(coalesce(q.analysis->'top', '[]')) || ' فوق 90%' as "في التحليل المعتمد",
       to_char(q.analyzed_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI') as "اعتُمد التحليل",
       p.kind as "الخطة",
       (select string_agg((x->>'name') || ' ' || (x->>'avg') || '%', '، ')
          from jsonb_array_elements(p.students) x) as "طلاب الخطة ونسبهم",
       length(coalesce(p.procedures, '')) as "طول الإجراءات"
  from public.quizzes q
  left join s on s.quiz_id = q.id
  left join public.teachers t on t.user_id = q.teacher_id or t.id = q.teacher_id
  left join public.quiz_plans p on p.quiz_id = q.id
 where q.analyzed_at is not null
 order by q.analyzed_at desc, p.kind
 limit 40;
-- نهاية الجزء 1
