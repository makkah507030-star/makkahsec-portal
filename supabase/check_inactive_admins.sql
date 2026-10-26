-- =====================================================================
-- قراءة فقط: الحسابات الإدارية التي لم تُفعَّل بعد، وكلمة مرورها الأولية رقم الهوية.
-- من يعرف رقم هوية صاحبها يدخل بصلاحياته، فتُعاد كلمات مرورها من «إعادة تعيين
-- كلمات المرور» أو يُطلب من أصحابها الدخول وتغييرها الآن.
-- يُنفَّذ في Supabase ← SQL Editor.
-- =====================================================================
select u.full_name as "الاسم", u.username as "اسم المستخدم",
       coalesce(string_agg(ar.role_type::text, '، '), '—') as "الأدوار الإدارية",
       u.created_at::date as "أُنشئ"
  from public.users u
  left join public.admin_roles ar on ar.user_id = u.id
 where u.role = 'admin' and u.is_active and u.activated_at is null and u.last_login is null
 group by u.id, u.full_name, u.username, u.created_at
 order by u.full_name;
-- نهاية الجزء 1
