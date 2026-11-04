-- =====================================================================
-- النشرات والاستبانات (إصلاح 4 نوفمبر 2026): حفظ نشرة أو استبانة جديدة كان يُرفض لكل الحسابات
-- برسالة «لا تملك صلاحية هذا الإجراء». البوابة تحفظ السطر وتطلبه في الطلب نفسه، وسياسة القراءة كانت
-- تتحقق من صاحبه بدالة تبحث عنه في الجدول (outreach_owner)، فلا تراه لأنه لم يُحفظ بعد.
-- الآن تقرأ عمود صاحب السطر مباشرة، والمدير والدعم الفني كما كانوا، والمستلم بعد الإرسال. تكرار التنفيذ آمن.
-- =====================================================================
drop policy if exists outreach_items_read on public.outreach_items;
create policy outreach_items_read on public.outreach_items for select to authenticated
  using (created_by = auth.uid() or public.has_admin_role(array['principal', 'tech_support'])
         or (sent_at is not null and public.outreach_recipient(id)));
-- نهاية الجزء 1
