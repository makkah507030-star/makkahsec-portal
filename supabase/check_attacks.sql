-- =====================================================================
-- قراءة فقط (لا يغيّر شيئًا): هل في السجلات أثر هجوم على البوابة؟
-- كل سطر مؤشر ونتيجته. «لا شيء» سليم، وغيره يُراجع.
-- يُنفَّذ في Supabase ← SQL Editor.
-- =====================================================================
with
-- ١) تخمين كلمات المرور: محاولات فاشلة كثيرة على حساب واحد في يوم واحد
brute as (
  select national_id, created_at::date d, count(*) n from public.login_log
   where not success and created_at > now() - interval '90 days'
   group by 1, 2 having count(*) >= 10
),
-- ٢) عنوان IP واحد دخل إلى حسابات كثيرة (قد يكون شبكة المدرسة نفسها: قارنه بعنوانها)
ips as (
  select ip_address ip, count(distinct payload->>'actor_id') n from auth.audit_log_entries
   where created_at > now() - interval '30 days' and payload->>'action' = 'login'
   group by 1 order by 2 desc limit 5
),
-- ٣) رفع الصلاحية بالثغرة المغلقة (users_update_own): حساب admin بلا دور إداري
esc as (
  select u.username, u.full_name from public.users u
   where u.role = 'admin' and not exists (select 1 from public.admin_roles r where r.user_id = u.id)
),
-- ٤) محاولات حقن شيفرة في ما يكتبه الزائر (سجل الدخول، وتذاكر الدعم)
pat as (select '<\s*(script|img|svg|iframe)|on(error|load)\s*=|javascript:|union\s+select' as p),
inj as (
  select 'سجل الدخول' src, count(*) n from public.login_log, pat
   where national_id ~* p or coalesce(reason, '') ~* p
  union all
  select 'تذاكر الدعم', count(*) from public.feedback, pat
   where message ~* p or coalesce(name, '') ~* p or coalesce(contact, '') ~* p or coalesce(page_url, '') ~* p
),
-- ٥) إغراق نموذج الدعم من الزوار: أكثر يوم فيه تذاكر
spam as (
  select created_at::date d, count(*) n from public.feedback
   group by 1 order by 2 desc limit 1
),
-- ٦) إشعارات بروابط خارجية (تصيّد عبر notify_ticket_support قبل إغلاقها)
ext as (
  select count(*) n from public.notifications where link ~* '^(https?:)?//' or link ~* 'javascript:'
),
-- ٧) مرفقات تذاكر بأنواع قابلة للتنفيذ (صفحات أو برامج بدل صور)
att as (
  select count(*) n from storage.objects
   where bucket_id = 'ticket-attachments'
     and (coalesce(metadata->>'mimetype', '') ~* 'html|svg|javascript|x-msdownload|php'
          or name ~* '\.(html?|svg|js|exe|php)$')
)
select '١) تخمين كلمات المرور (10 محاولات فاشلة فأكثر لحساب في يوم، آخر 90 يومًا)' as "المؤشر",
       coalesce((select string_agg(national_id || ' يوم ' || d || ': ' || n, ' · ' order by n desc) from brute), 'لا شيء') as "النتيجة"
union all
select '٢) أكثر عناوين IP دخولًا لحسابات مختلفة (30 يومًا)',
       coalesce((select string_agg(ip || ': ' || n || ' حسابًا', ' · ' order by n desc) from ips), 'لا بيانات')
union all
select '٣) حساب admin بلا دور إداري (أثر رفع صلاحية)',
       coalesce((select string_agg(username || ' ' || coalesce(full_name, ''), ' · ') from esc), 'لا شيء')
union all
select '٤) محاولات حقن شيفرة',
       coalesce((select string_agg(src || ': ' || n, ' · ') from inj where n > 0), 'لا شيء')
union all
select '٥) أكثر يوم فيه تذاكر دعم', coalesce((select d || ': ' || n || ' تذكرة' from spam), 'لا تذاكر')
union all
select '٦) إشعارات بروابط خارجية', case when (select n from ext) = 0 then 'لا شيء' else (select n from ext) || ' إشعار' end
union all
select '٧) مرفقات تذاكر بأنواع خطرة', case when (select n from att) = 0 then 'لا شيء' else (select n from att) || ' ملف' end;
-- نهاية الجزء 1
