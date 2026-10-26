-- =====================================================================
-- فحص قراءة فقط: أي ملفات SQL في دفعة الإصدار الثاني نُفِّذت؟ (لا يغيّر شيئًا)
-- لكل ملف سطر: «منفّذ» أو «لم يُنفَّذ» بحسب أثره في قاعدة البيانات.
-- يُنفَّذ في Supabase ← SQL Editor.
-- =====================================================================
select 'ach_gate.sql' as "الملف",
       case when exists (select 1 from pg_policies
                          where schemaname = 'public' and tablename = 'settings'
                            and policyname = 'settings_ach_gate_write')
            then 'منفّذ' else 'لم يُنفَّذ' end as "الحالة"
union all
select 'evidence_participation.sql',
       case when (select count(distinct template_key) from public.evidence_links
                   where template_key in ('training_attendance', 'cert_teacher_thanks')
                     and element = 'التفاعل مع المجتمع المهني') = 2
            then 'منفّذ' else 'لم يُنفَّذ' end
union all
select 'perf_cert_auto.sql',
       case when to_regclass('public.cert_auto_evidence') is not null
             and exists (select 1 from pg_trigger where tgname = 'cert_auto_to_file' and not tgisinternal)
            then 'منفّذ' else 'لم يُنفَّذ' end
union all
select 'referrals_auto_close.sql',
       case when to_regprocedure('public.referrals_auto_close()') is not null
            then 'منفّذ' else 'لم يُنفَّذ' end;
-- نهاية الجزء 1
