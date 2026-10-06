-- =====================================================================
-- تسريع قواعد الصلاحية (RLS) لجداول الحضور والطلاب — كما فعلنا مع الإشعارات
-- (notifications_rls_perf.sql)
--
-- السبب: القواعد تستدعي is_admin() وhas_any_admin_role(...) وcurrent_student_id()
-- وauth.uid() مباشرة، فتُنفَّذ مرة لكل صف. قراءة حضور يوم كامل (آلاف الصفوف)
-- في لوحة التحكم وشؤون الطلاب كانت تستغرق 0.9–2.3 ثانية، وعدّ الطلاب النشطين
-- قرابة 0.8 ثانية، لهذا السبب.
--
-- الحل: تغليف هذه الاستدعاءات بـ (select ...) فتُحسب مرة واحدة للاستعلام كله
-- (initplan). الصلاحيات لا تتغيّر: من يرى ومن يعدّل كما كان تمامًا؛ التغليف
-- يغيّر عدد مرات الحساب فقط لا نتيجته.
--
-- تعمل على القواعد الموجودة فعلًا في القاعدة (pg_policies) لا على نسخة مكتوبة
-- هنا، فلا تُفقد أي قاعدة أُضيفت أو عُدّلت لاحقًا. والاستدعاء المغلّف مسبقًا
-- لا يُغلَّف مرة ثانية.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

do $$
declare
  p record;
  q text;
  c text;
  -- يغلّف الاستدعاءات التي لا تعتمد على الصف، ما لم تكن مغلّفة
  wrap constant text[] := array[
    '(?<!SELECT )\mis_admin\(\)',
    '(?<!SELECT )\mcurrent_student_id\(\)',
    '(?<!SELECT )\mcurrent_teacher_id\(\)',
    '(?<!SELECT )\mauth\.uid\(\)',
    '(?<!SELECT )\mhas_any_admin_role\(ARRAY\[[^]]*\](::[a-z_]+\[\])?\)'
  ];
  w text;
  n int := 0;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in ('class_attendance', 'students', 'guardians', 'unmatched_logs',
                        'daily_attendance', 'excused_absences', 'schedule')
  loop
    q := p.qual;
    c := p.with_check;
    foreach w in array wrap loop
      if q is not null then q := regexp_replace(q, w, '(SELECT \&)', 'g'); end if;
      if c is not null then c := regexp_replace(c, w, '(SELECT \&)', 'g'); end if;
    end loop;

    if q is distinct from p.qual or c is distinct from p.with_check then
      execute format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename)
        || case when q is not null then format(' using (%s)', q) else '' end
        || case when c is not null then format(' with check (%s)', c) else '' end;
      n := n + 1;
    end if;
  end loop;
  raise notice 'حُدّثت % قاعدة', n;
end $$;

-- للتحقق: كل استدعاء صار داخل (SELECT ...)
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('class_attendance', 'students', 'guardians', 'unmatched_logs',
                    'daily_attendance', 'excused_absences', 'schedule')
order by tablename, policyname;
