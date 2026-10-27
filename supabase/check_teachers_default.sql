-- =====================================================================
-- قراءة فقط: حسابات المعلمين (غير الإداريين) وحالة كلمة مرورها، بأسمائها.
-- «الكلمة الأولية» تُقارن ببصمة كلمة المرور المحفوظة كما يفعل نظام الدخول، دون عرض أي كلمة.
-- ويظهر معها ما يعتمد عليه فحص «غير مفعّل» السابق (تاريخ التفعيل وآخر دخول في البوابة)
-- وآخر دخول فعلي من نظام الدخول، لمعرفة سبب ظهور الحساب هناك.
-- يُنفَّذ في Supabase ← SQL Editor (بضع ثوانٍ).
-- =====================================================================
select u.full_name as "الاسم", u.username as "اسم المستخدم",
       case when a.encrypted_password = extensions.crypt(
                   case when u.username ~ '^\d+$' and length(u.username) < 6 then lpad(u.username, 10, '0') else u.username end,
                   a.encrypted_password)
            then 'الكلمة الأولية' else 'غُيّرت' end as "كلمة المرور",
       case when u.activated_at is null and u.last_login is null then 'نعم' else 'لا' end as "ظهر في فحص «غير مفعّل»",
       a.last_sign_in_at::date as "آخر دخول فعلي",
       case when exists (select 1 from public.teachers t join public.schedule s on s.teacher_id = t.id
                          where t.user_id = u.id) then 'نعم' else 'لا' end as "له حصص في الجدول"
  from public.users u join auth.users a on a.id = u.id
 where u.role = 'teacher' and u.is_active
 order by 3, 4 desc, u.full_name;   -- الكلمة الأولية أولًا
-- نهاية الجزء 1
