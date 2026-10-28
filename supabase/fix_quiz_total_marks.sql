-- =====================================================================
-- تصحيح الدرجة الكلية لاختبارات صُحّحت بدرجات أسئلة تزيد عليها، وتحليلها المعتمد — الجزء 1 من 1.
-- مثال: «اختبار قصير» درجته الكلية 3 وأسئلته من 5، فظهرت النسب 166% و133% وانقلبت
-- الخطة العلاجية والإثرائية والتكريم (من حصل على 4 من 5 = 80% ظهر 133% متفوقًا).
-- • يُصحَّح فقط ما فيه درجة مرصودة أعلى من الدرجة الكلية (دليل قاطع على الخطأ)،
--   فتصير الدرجة الكلية مجموع درجات الأسئلة.
-- • ويُعاد حساب التحليل المعتمد (المتوسط، ومن يحتاج دعمًا دون 60%، والمتفوقون 90% فأكثر)
--   بالدرجة الصحيحة، فتظهر دورة الاختبار والتكريم بالنسب الصحيحة.
-- • الخطط المحفوظة لا تُمس: يعدّلها المعلم من دورة الاختبار بالطلاب الصحيحين.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
drop table if exists fixed_quizzes;
create temp table fixed_quizzes (id uuid, title text, old_total numeric, new_total numeric);

do $do$
declare z record; g jsonb;
begin
  for z in select q.id, q.title, q.total_marks as old_total, q.analyzed_at,
                  (select sum(marks) from public.quiz_questions qq where qq.quiz_id = q.id) as qsum
             from public.quizzes q
            where exists (select 1 from public.quiz_submissions s where s.quiz_id = q.id and s.score > q.total_marks)
  loop
    continue when z.qsum is null or z.qsum <= 0 or z.qsum = z.old_total;
    update public.quizzes set total_marks = z.qsum where id = z.id;
    insert into fixed_quizzes values (z.id, z.title, z.old_total, z.qsum);
    continue when z.analyzed_at is null;
    -- الطلاب المرصودون بنسبتهم الصحيحة (بالشكل الذي تحفظه دورة الاختبار)
    with r as (
      select s.student_id as id, st.full_name as name,
             trim(coalesce(case c.grade when 1 then 'الأول الثانوي' when 2 then 'الثاني الثانوي'
                                        when 3 then 'الثالث الثانوي' end, '') || ' ' || coalesce(c.class_no::text, '')) as cls,
             (round(s.score / z.qsum * 1000) / 10)::float8 as avg
        from public.quiz_submissions s
        join public.students st on st.id = s.student_id
        left join public.classes c on c.id = s.class_id
       where s.quiz_id = z.id and not coalesce(s.absent, false) and s.score is not null
    )
    select jsonb_build_object(
      'graded', (select count(*) from r),
      'avg', (select (round(avg(avg)::numeric * 10) / 10)::float8 from r),
      'support', coalesce((select jsonb_agg(to_jsonb(r) order by avg) from r where avg < 60), '[]'::jsonb),
      'top', coalesce((select jsonb_agg(to_jsonb(r) order by avg desc) from r where avg >= 90), '[]'::jsonb),
      'at', now()) into g;
    update public.quizzes set analysis = g where id = z.id;
  end loop;
end $do$;

-- النتيجة: الاختبارات المصحّحة وأرقام تحليلها الجديد
select f.title as "الاختبار", f.old_total as "الدرجة السابقة", f.new_total as "الدرجة الصحيحة",
       q.analysis->>'graded' as "المرصودون",
       jsonb_array_length(coalesce(q.analysis->'support', '[]')) as "يحتاجون دعمًا",
       jsonb_array_length(coalesce(q.analysis->'top', '[]')) as "المتفوقون"
  from fixed_quizzes f join public.quizzes q on q.id = f.id;
-- نهاية الجزء 1
