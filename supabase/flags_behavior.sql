-- =====================================================================
-- ملصق النموذج (عاجل / سري / للاطلاع والتوجيه) لنماذج السلوك والمواظبة المرسلة
-- للطالب وولي أمره (التعهد، ودعوة ولي الأمر، والإشعار بمشكلة سلوكية).
-- يُنفَّذ بعد behavior_forms.sql مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
alter table public.behavior_forms add column if not exists flag text
  constraint behavior_forms_flag_check check (flag in ('urgent', 'confidential', 'info'));
-- نهاية الجزء 1
