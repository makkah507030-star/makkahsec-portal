-- =====================================================================
-- حسابات وكلاء شؤون الطلاب — لإشعارهم بمراحل الإحالة من أي حساب
-- (المعلم حين يرفع الإحالة أو يعيد رفعها، وولي الأمر حين يرد).
-- جدول admin_roles لا يقرؤه إلا الإداريون، فتُعاد المعرّفات فقط من دالة.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.student_deputy_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct r.user_id), '{}')
    from admin_roles r join users u on u.id = r.user_id and u.is_active
   where r.role_type::text = 'deputy_students';
$$;
revoke execute on function public.student_deputy_ids() from public, anon;
grant  execute on function public.student_deputy_ids() to authenticated;
-- نهاية الجزء 1
