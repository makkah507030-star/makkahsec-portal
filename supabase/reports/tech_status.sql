-- تقرير الحالة التقنية للبوابة — قراءة فقط، لا يغيّر شيئًا
-- يُشغَّل في Supabase ← SQL Editor ← Run، وتُرسل نتيجته كاملة (جدول واحد: القسم، البند، القيمة)
with
tsz as (
  select c.relname as t, c.reltuples::bigint as n_rows,
         pg_total_relation_size(c.oid) as total, pg_indexes_size(c.oid) as idx
  from pg_class c join pg_namespace s on s.oid = c.relnamespace
  where s.nspname = 'public' and c.relkind = 'r'
),
obj as (
  select bucket_id, count(*) as n, coalesce(sum((metadata->>'size')::bigint), 0) as bytes
  from storage.objects group by bucket_id
),
r as (
  select 1 as o, 'القاعدة' as sec, 'حجم قاعدة البيانات' as item, pg_size_pretty(pg_database_size(current_database())) as val
  union all select 2, 'القاعدة', 'جداول public', count(*)::text from tsz
  union all select 3, 'القاعدة', 'حجم جداول public مع فهارسها', pg_size_pretty(sum(total)) from tsz
  union all select 4, 'القاعدة', 'منها فهارس', pg_size_pretty(sum(idx)) from tsz
  union all select 5, 'القاعدة', 'سياسات الحماية RLS', count(*)::text from pg_policies where schemaname = 'public'
  union all select 6, 'القاعدة', 'جداول بلا RLS مفعّل', coalesce(string_agg(c.relname, '، '), 'لا يوجد')
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  union all select 7, 'القاعدة', 'الدوال', count(*)::text
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'
  union all select 8, 'القاعدة', 'المشغّلات (triggers)', count(*)::text
    from pg_trigger g join pg_class c on c.oid = g.tgrelid join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and not g.tgisinternal
  union all select 9, 'القاعدة', 'نسبة القراءة من الذاكرة (cache hit)',
    round(100.0 * sum(blks_hit) / nullif(sum(blks_hit) + sum(blks_read), 0), 2)::text || '%'
    from pg_stat_database where datname = current_database()
  union all select 10, 'القاعدة', 'الاتصالات الآن / الحد',
    (select count(*) from pg_stat_activity)::text || ' / ' || current_setting('max_connections')
  union all select 11, 'القاعدة', 'إصدار PostgreSQL', split_part(version(), ' ', 2)
  union all
  select 20 + rn, 'أكبر الجداول', t, pg_size_pretty(total) || ' · نحو ' || greatest(n_rows, 0) || ' صف'
  from (select *, row_number() over (order by total desc) as rn from tsz) x where rn <= 12
  union all select 40, 'الحسابات', 'كل الحسابات', count(*)::text from auth.users
  union all select 41, 'الحسابات', 'دخلوا خلال 7 أيام', count(*)::text
    from auth.users where last_sign_in_at > now() - interval '7 days'
  union all select 42, 'الحسابات', 'اشتراكات الإشعارات (push)', count(*)::text from public.push_subscriptions
  union all
  select 50 + row_number() over (order by bytes desc), 'التخزين', bucket_id,
         pg_size_pretty(bytes) || ' · ' || n || ' ملف'
  from obj
  union all select 70, 'التخزين', 'المجموع', pg_size_pretty(coalesce(sum(bytes), 0)) || ' · ' || coalesce(sum(n), 0) || ' ملف' from obj
  union all
  select 80 + rn, 'جداول تحتاج تنظيفًا', relname, n_dead_tup || ' صف ميت مقابل ' || n_live_tup
  from (select relname, n_dead_tup, n_live_tup, row_number() over (order by n_dead_tup desc) as rn
        from pg_stat_user_tables where schemaname = 'public' and n_dead_tup > 1000
          and n_dead_tup > n_live_tup * 0.2) d where rn <= 5
)
select sec as "القسم", item as "البند", val as "القيمة" from r order by o;
-- نهاية الاستعلام
