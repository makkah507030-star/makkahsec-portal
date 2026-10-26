-- =====================================================================
-- إيقاف دخول الحسابات الإدارية التي لم تُستعمل وكلمة مرورها ما زالت رقم الهوية
-- (نتيجة check_default_passwords.sql في 26 أكتوبر 2026). يمنع نظام الدخول نفسه
-- تسجيلها (banned_until)، ولا يحذف الحساب ولا أدواره.
-- إعادة الدخول لحساب حين يحتاجه صاحبه: السطر المعطّل في آخر الملف، ثم يُسلَّم
-- كلمة مرور مؤقتة غير رقم هويته ويغيّرها عند أول دخول.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
update auth.users a
   set banned_until = '2100-01-01'
  from public.users u
 where u.id = a.id
   and u.username in ('1004453849', '1001623428', '1045574363');

-- التحقق: يجب أن تظهر الثلاثة «موقوف»
select u.full_name as "الاسم", u.username as "اسم المستخدم",
       case when a.banned_until > now() then 'موقوف' else 'يستطيع الدخول' end as "الدخول"
  from public.users u join auth.users a on a.id = u.id
 where u.username in ('1004453849', '1001623428', '1045574363');

-- إعادة الدخول لحساب واحد (ضع اسم المستخدم):
-- update auth.users a set banned_until = null from public.users u where u.id = a.id and u.username = '...';
-- نهاية الجزء 1
