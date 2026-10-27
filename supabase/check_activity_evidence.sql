-- =====================================================================
-- قراءة فقط: لماذا لا يظهر شاهد «النشاط الصفي» (4-2) رغم استخدام بطاقة من بنك الأنشطة؟
-- يُحتسب الشاهد بيوم لكل نشاط «سجّل المعلم تنفيذه» من بطاقة صفية (لا حقيبة الانتظار).
-- لكل معلم استخدم بنك الأنشطة: ما سُجّل، ونوعه، وما يحسبه ملف الأداء فعلًا.
-- يُنفَّذ في Supabase ← SQL Editor.
-- =====================================================================
with uses as (
  select a.user_id, count(*) filter (where a.context = 'class') as cls,
         count(*) filter (where a.context = 'waiting') as wait,
         count(distinct a.used_on) filter (where a.context = 'class') as cls_days,
         max(a.created_at) as last_at,
         min(a.created_at) as first_at
    from public.activity_uses a group by a.user_id
),
perf as (
  select teacher_user_id, cnt from public.perf_auto_counts_core(
    null, (select value from public.settings where key = 'active_year'))
   where item_key = 'e04_02'
)
select coalesce(t.full_name, u.full_name, '—') as "المعلم",
       uses.cls as "تنفيذ صفي مسجّل", uses.wait as "تنفيذ في الانتظار",
       uses.cls_days as "أيام صفية",
       coalesce(perf.cnt, 0) as "يحسبه ملف الأداء (4-2)",
       to_char(uses.first_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD') as "أول تسجيل",
       to_char(uses.last_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD') as "آخر تسجيل"
  from uses
  left join public.users u on u.id = uses.user_id
  left join public.teachers t on t.user_id = uses.user_id
  left join perf on perf.teacher_user_id = uses.user_id
union all
select '— جدول نقاط الدوري موجود؟ (شرط للحساب)',
       null, null, null,
       case when to_regclass('public.subject_league_points') is null then 0 else 1 end,
       case when to_regclass('public.subject_league_points') is null then 'غير موجود: لا يُحسب أي نشاط' else 'موجود' end,
       (select min(start_date)::text from public.academic_calendar
         where academic_year = (select value from public.settings where key = 'active_year'))
order by 5 desc nulls last;
-- نهاية الجزء 1
