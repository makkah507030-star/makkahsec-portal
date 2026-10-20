-- متابعة دورات الاختبار: صارت صفحة في «الشؤون التعليمية»، فيراها وكيل الشؤون التعليمية
-- مع المدير والدعم الفني. يعيد تعريف perf_open_cycles (quiz_verify_3.sql) بالصلاحية الجديدة فقط.
create or replace function public.perf_open_cycles(p_year text)
returns table (teacher_user_id uuid, quiz_id uuid, title text, period text, stage text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select z.teacher_id, z.id, z.title, z.period,
         case
           when z.status = 'draft' then 'البناء والتطبيق'
           when not exists (select 1 from public.quiz_submissions s where s.quiz_id = z.id and s.score is not null) then 'التصحيح والرصد'
           when z.analyzed_at is null then 'التحليل'
           when (z.period = 'diagnostic' or jsonb_array_length(coalesce(z.analysis->'support', '[]'::jsonb)) > 0)
                and not exists (select 1 from public.quiz_plans p where p.quiz_id = z.id and p.kind = 'remedial') then 'الخطة'
           when exists (select 1 from public.quiz_plans p where p.quiz_id = z.id and p.status <> 'done') then 'التنفيذ'
           when exists (select 1 from public.quiz_plans p where p.quiz_id = z.id and p.kind = 'remedial' and p.measured_at is null) then 'التحقق من الأثر'
           when exists (select 1 from public.quiz_plans p where p.quiz_id = z.id and p.kind = 'remedial' and p.round = 1
                          and coalesce((p.impact->>'below')::int, 0) > 0
                          and not exists (select 1 from public.quiz_plans p2 where p2.quiz_id = z.id and p2.kind = 'remedial' and p2.round = 2))
             then 'الخطة الثانية'
           else 'التكريم والإغلاق'
         end,
         z.created_at
    from public.quizzes z
   where public.has_admin_role(array['principal', 'tech_support', 'deputy_academic'])
     and z.period in ('diagnostic', 'period1', 'period2')
     and coalesce(z.academic_year, p_year) = p_year
     and z.cycle_closed_at is null
   order by z.created_at;
$$;
revoke execute on function public.perf_open_cycles(text) from public, anon;
grant  execute on function public.perf_open_cycles(text) to authenticated;
-- نهاية الجزء 1
