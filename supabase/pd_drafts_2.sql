-- =====================================================================
-- نماذج التطوير المهني (الجزء 2 من 2): حذف المسودات الفارغة القديمة — بعد الجزء 1.
-- يُحذف ما يجتمع فيه كل التالي فقط: حالته «مسودة»، ولم يُكتب فيه شيء (لا بيانات ولا حضور
-- ولا مرفقات ولا تواقيع)، ومضى على إنشائه أكثر من 3 أيام. ما فيه أي محتوى لا يُمس.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
delete from public.pd_reports r
 where r.status = 'draft'
   and (r.data - 'provider') = '{}'::jsonb and r.attendees = '[]'::jsonb and r.files = '[]'::jsonb
   and not exists (select 1 from public.pd_signatures g where g.report_id = r.id)
   and r.created_at < now() - interval '3 days'
returning r.serial as "النموذج المحذوف", r.owner_name as "المعلم", r.created_at::date as "أُنشئ";
-- نهاية الجزء 2
