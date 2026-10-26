-- =====================================================================
-- الدعم الفني للزائر غير المسجّل — الجزء 1 من 1.
-- • طلب الزائر يُحفظ بلا صاحب حساب (user_id = null) في submit_public_feedback، والعمود
--   كان لا يقبل الفراغ، فيفشل كل طلب زائر («null value in column "user_id"»).
-- • feedback_public_insert كانت تتيح لغير المسجّل الكتابة في الجدول مباشرة بلا شرط
--   متجاوزًا حدود التكرار في الدالة: الزائر يرسل عبر الدالة وحدها، والمسجّل باسمه هو.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
alter table public.feedback alter column user_id drop not null;

-- المسجّل يبقى يرسل بالسياسة الموجودة «user insert own ticket» (user_id = auth.uid())
drop policy if exists feedback_public_insert on public.feedback;
-- نهاية الجزء 1
