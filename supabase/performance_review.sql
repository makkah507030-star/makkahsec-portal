-- =====================================================================
-- الأداء الوظيفي — المرحلة الثالثة: التقييم والإقرار ولوحة المدير.
--
-- • perf_reviews: تقييم المعلم في مرحلتين (mid: المراجعة النصف سنوية،
--   final: التقييم النهائي). يقدّر المدير العناصر الـ11 من 1 إلى 5 ويكتب
--   الإيجابيات والتوصيات، ثم يرسله للمعلم فيُقفل عن التعديل. يطّلع المعلم
--   ويكتب إضافاته ويقرّ بالاطلاع. لا يرى التقييم إلا المدير والمعلم صاحبه،
--   والمعلم لا يرى المرحلة قبل إرسالها. التقرير المعتمد في نظام فارس.
-- • perf_open_cycles: دورات الاختبار غير المكتملة (للمدير والدعم الفني).
-- • perf_duty_indicators: مؤشرات مساندة لعنصر «أداء الواجبات الوظيفية» (للمدير).
--
-- يُنفَّذ بعد ملفات المرحلتين السابقتين. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.perf_reviews (
  id uuid primary key default gen_random_uuid(),
  teacher_user_id uuid not null,
  academic_year text not null,
  stage text not null check (stage in ('mid', 'final')),
  ratings jsonb not null default '{}'::jsonb,     -- { e01: 4, e02: 5, ... }
  positives text,
  recommendations text,
  sent_at timestamptz,                            -- بعد الإرسال لا يُعدَّل
  teacher_note text,                              -- إضافات المعلم
  ack_at timestamptz,                             -- إقرار المعلم بالاطلاع
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_user_id, academic_year, stage)
);

alter table public.perf_reviews enable row level security;

drop policy if exists perf_reviews_principal on public.perf_reviews;
create policy perf_reviews_principal on public.perf_reviews for all to authenticated
  using (public.has_admin_role(array['principal']) and sent_at is null)
  with check (public.has_admin_role(array['principal']));

drop policy if exists perf_reviews_read on public.perf_reviews;
create policy perf_reviews_read on public.perf_reviews for select to authenticated
  using (public.has_admin_role(array['principal'])
         or (teacher_user_id = auth.uid() and sent_at is not null));

-- إقرار المعلم: يكتب إضافاته ويقرّ، ويصل المدير إشعار
create or replace function public.perf_review_ack(p_id uuid, p_note text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.perf_reviews;
  at timestamptz := now();
  principals uuid[];
begin
  select * into r from public.perf_reviews where id = p_id for update;
  if not found or r.teacher_user_id is distinct from auth.uid() or r.sent_at is null then
    raise exception 'التقييم غير موجود أو لم يُرسل إليك';
  end if;
  if r.ack_at is not null then
    return r.ack_at;
  end if;
  update public.perf_reviews
     set teacher_note = nullif(trim(coalesce(p_note, '')), ''), ack_at = at, updated_at = at
   where id = p_id;
  select array_agg(user_id) into principals from public.admin_roles where role_type::text = 'principal';
  if principals is not null then
    perform public.send_notification(
      'اطّلع معلم على تقييمه',
      (select coalesce(full_name, 'معلم') from public.users where id = auth.uid())
        || ' أقرّ بالاطلاع على ' || case r.stage when 'mid' then 'المراجعة النصف سنوية' else 'التقييم النهائي' end,
      'general', '/performance', null, principals, null, null, true);
  end if;
  return at;
end;
$$;

revoke execute on function public.perf_review_ack(uuid, text) from public, anon;
grant  execute on function public.perf_review_ack(uuid, text) to authenticated;

-- دورات الاختبار غير المكتملة ومرحلتها الحالية
create or replace function public.perf_open_cycles(p_year text)
returns table (teacher_user_id uuid, quiz_id uuid, title text, period text, stage text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select z.teacher_id, z.id, z.title, z.period,
         case
           when z.status = 'draft' then 'البناء والتطبيق'
           when not exists (select 1 from public.quiz_submissions s where s.quiz_id = z.id and s.score is not null) then 'التصحيح والرصد'
           when z.analyzed_at is null then 'التحليل'
           when (z.period = 'diagnostic' or jsonb_array_length(coalesce(z.analysis->'support', '[]'::jsonb)) > 0)
                and not exists (select 1 from public.quiz_plans p where p.quiz_id = z.id and p.kind = 'remedial') then 'الخطة'
           when exists (select 1 from public.quiz_plans p where p.quiz_id = z.id and p.status <> 'done') then 'التنفيذ'
           else 'التكريم والإغلاق'
         end,
         z.created_at
    from public.quizzes z
   where public.has_admin_role(array['principal', 'tech_support'])
     and z.period in ('diagnostic', 'period1', 'period2')
     and coalesce(z.academic_year, p_year) = p_year
     and z.cycle_closed_at is null
   order by z.created_at;
$$;

revoke execute on function public.perf_open_cycles(text) from public, anon;
grant  execute on function public.perf_open_cycles(text) to authenticated;

-- مؤشرات مساندة لأداء الواجبات الوظيفية: لا تُصدر حكمًا، تعين المدير على التقدير
create or replace function public.perf_duty_indicators(p_uid uuid, p_year text)
returns table (key text, label text, value bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tid uuid;
  y_start timestamptz;
begin
  if not public.has_admin_role(array['principal']) then
    raise exception 'غير مصرّح';
  end if;
  select id into tid from public.teachers where user_id = p_uid;
  select min(start_date)::timestamptz into y_start from public.academic_calendar where academic_year = p_year;
  y_start := coalesce(y_start, now() - interval '1 year');

  return query
  select 'substitute', 'حصص انتظار نفّذها', count(*) from public.substitute_periods
   where cover_teacher_id = tid and academic_year = p_year
  union all
  select 'covered', 'حصص له غطّاها زملاؤه في غيابه', count(*) from public.substitute_periods
   where absent_teacher_id = tid and academic_year = p_year
  union all
  select 'attendance', 'حصص حضّرها', count(distinct (ca.schedule_id, ca.attend_date)) from public.class_attendance ca
   where ca.recorded_by = p_uid and ca.academic_year = p_year
  union all
  select 'visits', 'زيارات دعم استلمها', count(*) from public.form_documents d
    join public.form_templates ft on ft.id = d.template_id
   where d.recipient_user_id = p_uid and ft.key = 'teacher_support_visit'
     and d.status not in ('draft', 'pending', 'rejected') and d.created_at >= y_start
  union all
  select 'late', 'تنبيهات تأخر أو انصراف', count(*) from public.form_documents d
    join public.form_templates ft on ft.id = d.template_id
   where d.recipient_user_id = p_uid and ft.key in ('frm_late_notice', 'frm_hours_deduction')
     and d.status not in ('draft', 'pending', 'rejected') and d.created_at >= y_start
  union all
  select 'absence', 'مساءلات أو قرارات غياب', count(*) from public.form_documents d
    join public.form_templates ft on ft.id = d.template_id
   where d.recipient_user_id = p_uid and ft.key in ('frm_absence_inquiry', 'frm_absence_deduction')
     and d.status not in ('draft', 'pending', 'rejected') and d.created_at >= y_start;
end;
$$;

revoke execute on function public.perf_duty_indicators(uuid, text) from public, anon;
grant  execute on function public.perf_duty_indicators(uuid, text) to authenticated;
