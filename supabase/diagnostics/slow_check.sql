-- تشخيص «الاتصال أبطأ من المعتاد»: للقراءة فقط، لا يغيّر شيئًا.
-- شغّله في Supabase ← SQL Editor وأرسل النتائج الثلاث (صورة أو نسخ).

-- 1) الاتصالات الآن: كم منها نشط أو عالق، وأطول استعلام جارٍ
select state, count(*) as n,
       max(now() - query_start) filter (where state <> 'idle') as longest
  from pg_stat_activity
 where datname = current_database()
 group by state order by n desc;

-- 2) أبطأ الاستعلامات منذ آخر تصفير (المتوسط بالملّي ثانية، وعدد المرات)
select round(mean_exec_time::numeric, 0) as avg_ms,
       calls,
       round(total_exec_time::numeric / 1000, 0) as total_sec,
       left(regexp_replace(query, '\s+', ' ', 'g'), 160) as query
  from pg_stat_statements
 where query not ilike '%pg_stat%'
 order by total_exec_time desc
 limit 12;

-- 3) الاستعلامات الجارية الآن منذ أكثر من 5 ثوانٍ
select pid, now() - query_start as running, state,
       left(regexp_replace(query, '\s+', ' ', 'g'), 160) as query
  from pg_stat_activity
 where datname = current_database() and state <> 'idle'
   and now() - query_start > interval '5 seconds'
 order by running desc;
-- نهاية الجزء 1
