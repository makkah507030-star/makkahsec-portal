-- =====================================================================
-- الأداء الوظيفي: تفاصيل الشواهد الآلية.
--
-- perf_auto_details: الشواهد التي حُسب منها عدّاد بند آلي واحد لمعلم واحد،
-- سطر لكل شاهد (عنوان، وتفصيل، وتاريخ)، ليطّلع عليها المعلم في ملفه ويقيّمها
-- المدير من ملف المعلم. نفس مصادر perf_auto_counts وشروطها.
-- يستدعيها المعلم لنفسه، ومدير المدرسة والدعم الفني لأي معلم.
--
-- يُنفَّذ بعد quiz_cycle.sql. تكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.perf_auto_details(p_uid uuid, p_year text, p_item text)
returns table (r_title text, r_detail text, r_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  y_start timestamptz;
  tid uuid;
begin
  if not public.has_admin_role(array['principal', 'tech_support']) and p_uid is distinct from auth.uid() then
    raise exception 'غير مصرّح';
  end if;
  select min(start_date)::timestamptz into y_start
    from public.academic_calendar where academic_year = p_year;
  y_start := coalesce(y_start, now() - interval '1 year');
  select id into tid from public.teachers where user_id = p_uid;

  return query
  with q as (
    select z.id, z.title, z.period, z.mode, z.status, z.analyzed_at, z.analysis, z.created_at,
           z.subject_name, z.total_marks,
           case z.period when 'diagnostic' then 'تشخيصي' when 'period1' then 'الفترة الأولى' else 'الفترة الثانية' end as plabel
      from public.quizzes z
     where z.teacher_id = p_uid
       and coalesce(z.academic_year, p_year) = p_year
       and z.period in ('diagnostic', 'period1', 'period2')
  ),
  fu as (
    select f.item_key as k, f.updated_at,
           case f.item_key when 'homework' then 'الواجبات' when 'participation' then 'المشاركة'
                           when 'classwork' then 'التطبيقات الصفية' when 'written' then 'نظري'
                           when 'practical' then 'عملي' else f.item_key end as klabel
      from public.teacher_follow_up f
     where f.teacher_id = tid and f.academic_year = p_year
  ),
  res as (
    -- الاختبارات المطبّقة
    select q.title::text, (q.plabel || coalesce(' · ' || q.subject_name, '') || case when q.mode = 'online' then ' · إلكتروني' else ' · ورقي' end)::text, q.created_at
      from q
     where q.status <> 'draft'
       and (p_item = 'e11_07'
            or (p_item = 'e11_01' and q.period = 'diagnostic')
            or (p_item = 'e11_05' and q.period in ('period1', 'period2'))
            or (p_item = 'e07_06' and q.mode = 'online'))
    union all
    -- الاختبارات المرصودة: عدد المرصودين والمتوسط
    select q.title::text,
           (q.plabel || ' · المرصودون ' || count(*) || ' · المتوسط '
             || round(avg(s.score)::numeric, 1) || coalesce(' من ' || q.total_marks, ''))::text,
           max(s.marked_at)
      from q join public.quiz_submissions s on s.quiz_id = q.id
     where s.score is not null and p_item in ('e05_02', 'e03_02', 'e10_03', 'e11_04')
     group by q.id, q.title, q.plabel, q.total_marks
    union all
    -- التحليلات المعتمدة
    select q.title::text,
           (q.plabel || ' · يحتاجون دعمًا ' || jsonb_array_length(coalesce(q.analysis->'support', '[]'::jsonb))
             || ' · متفوقون ' || jsonb_array_length(coalesce(q.analysis->'top', '[]'::jsonb)))::text,
           q.analyzed_at
      from q
     where q.analyzed_at is not null and p_item in ('e10_01', 'e10_02')
    union all
    -- الخطط العلاجية والإثرائية
    select q.title::text,
           ((case p.kind when 'remedial' then 'خطة علاجية' else 'خطة إثرائية' end)
             || coalesce(' · ' || nullif(p.skills, ''), '')
             || coalesce(' · ' || to_char(p.start_date, 'YYYY/MM/DD') || ' – ' || to_char(p.end_date, 'YYYY/MM/DD'), '')
             || case when p.status = 'done' then ' · نُفّذت' else ' · لم تُنفّذ بعد' end)::text,
           coalesce(p.done_at, p.created_at)
      from public.quiz_plans p join q on q.id = p.quiz_id
     where (p_item = 'e05_05' and p.kind = 'remedial' and coalesce(p.skills, '') <> '')
        or (p_item = 'e05_06' and p.kind = 'remedial')
        or (p_item = 'e05_07' and p.kind = 'enrichment')
        or (p_item = 'e06_04' and p.kind = 'remedial' and p.status = 'done')
        or (p_item = 'e06_05' and p.kind = 'enrichment' and p.status = 'done')
    union all
    -- إشعارات المعلم لفصوله وأولياء أمورهم
    select n.title::text, left(coalesce(n.body, ''), 120)::text, n.created_at
      from public.notifications n
     where p_item in ('e03_01', 'e05_04') and tid is not null
       and n.created_by = p_uid and not n.is_auto and n.created_at >= y_start
    union all
    -- سجل المتابعة: يوم لكل تاريخ رصد، وما رُصد فيه
    select to_char(fu.updated_at::date, 'YYYY/MM/DD')::text, ('رصد: ' || string_agg(distinct fu.klabel, '، '))::text, max(fu.updated_at)
      from fu
     where p_item = 'e03_06'
     group by fu.updated_at::date
    union all
    -- أنواع التقويم المستخدمة في سجل المتابعة
    select fu.klabel::text, ('عدد مرات الرصد ' || count(*))::text, max(fu.updated_at)
      from fu
     where p_item in ('e11_02', 'e11_03')
     group by fu.klabel
    union all
    -- الشهادات التي أصدرها المعلم لطلابه
    select coalesce(ft.title, d.title, 'شهادة')::text, coalesce(st.full_name, '')::text, d.created_at
      from public.form_documents d
      join public.form_templates ft on ft.id = d.template_id
      left join public.students st on st.id = d.student_id
     where p_item = 'e05_10' and tid is not null
       and ft.category = 'certificate' and d.student_id is not null
       and d.status not in ('draft', 'pending', 'rejected') and d.created_at >= y_start
       and d.created_by = p_uid
  )
  select * from res order by 3 desc nulls last limit 200;
end;
$$;

revoke execute on function public.perf_auto_details(uuid, text, text) from public, anon;
grant  execute on function public.perf_auto_details(uuid, text, text) to authenticated;
