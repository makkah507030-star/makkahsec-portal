-- =====================================================================
-- قراءة فقط: من كلمة مروره ما زالت الكلمة الأولية (رقم الهوية)؟
-- يقارن الكلمة الأولية ببصمة كلمة المرور المحفوظة (bcrypt) كما يفعل نظام الدخول،
-- دون عرض أي كلمة مرور. الجزء ١ للحسابات الإدارية بأسمائها، والجزء ٢ أعداد البقية.
-- الجزء ٢ أبطأ (ثانية لكل نحو 15 حسابًا)؛ يُشغَّل وحده إن احتجت الأعداد.
-- يُنفَّذ في Supabase ← SQL Editor.
-- =====================================================================

-- ١) الحسابات الإدارية
select u.full_name as "الاسم", u.username as "اسم المستخدم",
       coalesce((select string_agg(ar.role_type::text, '، ') from public.admin_roles ar where ar.user_id = u.id), '—') as "الأدوار",
       case when a.encrypted_password = extensions.crypt(
                   case when u.username ~ '^\d+$' and length(u.username) < 6 then lpad(u.username, 10, '0') else u.username end,
                   a.encrypted_password)
            then 'خطر: الكلمة الأولية' else 'غُيّرت' end as "كلمة المرور",
       a.last_sign_in_at::date as "آخر دخول"
  from public.users u join auth.users a on a.id = u.id
 where u.role = 'admin' and u.is_active
 order by 4, u.full_name;   -- «خطر» أولًا

-- ٢) أعداد البقية (شغّله وحده بتظليله إن أردت)
-- select u.role, count(*) filter (where a.encrypted_password = extensions.crypt(
--          case when u.username ~ '^\d+$' and length(u.username) < 6 then lpad(u.username, 10, '0') else u.username end,
--          a.encrypted_password)) as "بالكلمة الأولية", count(*) as "الكل"
--   from public.users u join auth.users a on a.id = u.id where u.is_active group by u.role;
-- نهاية الجزء 1
