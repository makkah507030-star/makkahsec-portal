-- =====================================================================
-- نماذج التطوير المهني (الجزء 1 من 2): رقم النموذج لا يتكرر، وفحص المسودات.
-- • كان الرقم PD-<العام>-<عدد النماذج + 1>: فإذا حُذفت مسودة نقص العدد، فأخذ النموذج
--   التالي رقمًا مستعملًا من قبل (رقمان متطابقان). صار: أكبر رقم في العام + 1.
-- • ثم فحص للقراءة: المسودات الفارغة (أُنشئت بالضغط على «+ نموذج جديد» ولم يُكتب فيها شيء)،
--   والأرقام المكررة الحالية إن وُجدت.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.pd_serial()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.serial := 'PD-' || coalesce(new.academic_year, '') || '-' ||
    lpad((coalesce((select max(nullif(regexp_replace(serial, '^.*-', ''), '')::int) from pd_reports
                     where academic_year is not distinct from new.academic_year
                       and serial ~ '-[0-9]+$'), 0) + 1)::text, 4, '0');
  return new;
end;
$$;

-- الفحص: المسودات، والفارغة منها، والأرقام المكررة
with d as (
  select r.*, (r.data - 'provider') = '{}'::jsonb and r.attendees = '[]'::jsonb and r.files = '[]'::jsonb
              and not exists (select 1 from public.pd_signatures g where g.report_id = r.id) as empty
    from public.pd_reports r where r.status = 'draft'
)
select 'المسودات' as "البند", count(*)::text as "العدد",
       count(*) filter (where empty)::text || ' فارغة تمامًا · ' || count(*) filter (where not empty) || ' فيها محتوى' as "التفصيل"
  from d
union all
select 'المسودات الفارغة الأقدم من 3 أيام', count(*)::text, count(distinct owner_user_id)::text || ' معلمًا'
  from d where empty and created_at < now() - interval '3 days'
union all
select 'أرقام نماذج مكررة', count(*)::text,
       coalesce(string_agg(serial, '، '), 'لا شيء')
  from (select serial from public.pd_reports group by serial having count(*) > 1) x;
-- نهاية الجزء 1
