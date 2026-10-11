-- =====================================================================
-- ملصق النموذج (عاجل / سري / للاطلاع والتوجيه) للنماذج المرسلة والإحالات.
-- يحدده مرسل النموذج، ويظهر للمستلم في «بانتظار إجرائك» وفي القوائم.
-- (استمارة مستوى الطالب لها عمودها في guidance_inquiry_1.sql.)
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
alter table public.form_documents add column if not exists flag text
  constraint form_documents_flag_check check (flag in ('urgent', 'confidential', 'info'));

alter table public.student_referrals add column if not exists flag text
  constraint student_referrals_flag_check check (flag in ('urgent', 'confidential', 'info'));
-- نهاية الجزء 1
