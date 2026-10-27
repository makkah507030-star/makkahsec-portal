-- =====================================================================
-- فحص أمني للقراءة فقط (لا يغيّر شيئًا) — المراجعة الأمنية للإصدار الأول.
-- كل سطر: البند، والنتيجة. «خطر» يحتاج إصلاحًا، و«سليم» لا يحتاج.
-- يُنفَّذ في Supabase ← SQL Editor.
-- =====================================================================
with
-- ١) هل يستطيع المستخدم تعديل صفه في users (ومنه role)؟
upd as (
  select exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'users'
                  and policyname = 'users_update_own') as has_pol,
         exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
                  where c.relname = 'users' and c.relnamespace = 'public'::regnamespace
                    and not t.tgisinternal and t.tgtype & 16 = 16) as has_upd_trigger,
         has_column_privilege('authenticated', 'public.users', 'role', 'UPDATE') as col_upd
),
-- ٢) جداول بلا RLS
norls as (
  select string_agg(c.relname, '، ' order by c.relname) as t
    from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity
),
-- ٣) دوال SECURITY DEFINER يستطيع غير المسجّل (anon) استدعاءها
anonfn as (
  select count(*) as n,
         string_agg(p.proname, '، ' order by p.proname)
           filter (where p.proname in ('clear_today_device_punches', 'missing_students', 'student_day_timeline',
                                       '_finish_online_attempt', 'set_notification_meta', 'grade_submission',
                                       '_sweep_online_quiz', 'link_duty_names', 'substitute_roster',
                                       'official_daily_status', 'quiz_period_summary')) as risky
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prosecdef
     and has_function_privilege('anon', p.oid, 'EXECUTE')
),
-- ٤) جداول يكتب فيها غير المسجّل
anonins as (
  select string_agg(distinct tablename, '، ') as t
    from pg_policies
   where schemaname = 'public' and cmd in ('INSERT', 'ALL')
     and (roles @> array['anon']::name[] or roles @> array['public']::name[])
     and coalesce(with_check, qual, 'true') = 'true'
),
-- ٥) مخازن ملفات عامة
pubb as (select string_agg(id, '، ') as b from storage.buckets where public),
-- ٦) حسابات لم يدخل بها أحد قط (من نظام الدخول نفسه؛ activated_at وlast_login في users
--    لا يُعتمد عليهما: الأول يُسجَّل منذ إضافته فقط، والثاني لا يحدّثه شيء)
inact as (
  select string_agg(role::text || ': ' || n, ' · ') as s from (
    select u.role, count(*) n from public.users u join auth.users a on a.id = u.id
     where u.is_active and a.last_sign_in_at is null group by u.role) x
)
select '١) تعديل المستخدم دوره بنفسه (users.role)' as "البند",
       case when has_pol and not has_upd_trigger and col_upd then 'خطر: السياسة موجودة بلا حارس'
            when has_pol then 'تحقق: السياسة موجودة ومعها حارس أو تقييد أعمدة'
            else 'سليم' end as "النتيجة" from upd
union all select '٢) جداول بلا RLS', coalesce('خطر: ' || t, 'سليم') from norls
union all select '٣) دوال مرتفعة الصلاحية متاحة لغير المسجّل',
       n || ' دالة' || coalesce(' · منها الحساسة: ' || risky, ' · لا حساسة منها') from anonfn
union all select '٤) جداول يكتب فيها غير المسجّل بلا شرط', coalesce(t, 'لا شيء') from anonins
union all select '٥) مخازن ملفات عامة', coalesce(b, 'لا شيء') from pubb
union all select '٦) حسابات لم يُدخل بها قط', coalesce(s, 'لا شيء') from inact;
-- نهاية الجزء 1
