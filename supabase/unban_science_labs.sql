-- =====================================================================
-- إعادة دخول محضري مختبرات العلوم: عبدالله اللهيبي (أحياء)، وسالم حديد (كيمياء)، وعبدالواسع الدعدي (فيزياء).
-- أوقف security_fix_2.sql دخولهم (banned_until) لأن كلمة مرورهم كانت رقم الهوية ولم يُستعمل الحساب.
-- يرفع الإيقاف ويفعّل الحساب فقط، ولا يغيّر كلمة المرور: بعده تُصدر لكل واحد كلمة مؤقتة من
-- «استعادة كلمة المرور» في البوابة، فيغيّرها عند أول دخول. يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
with t as (
  select u.id from public.users u
   where (u.full_name like '%اللهيبي%' and u.full_name ~ 'عبد ?الله')
      or (u.full_name like '%حديد%' and u.full_name like '%سالم%')
      or (u.full_name like '%الدعدي%' and u.full_name ~ 'عبد ?الواسع')
)
update auth.users a set banned_until = null from t where a.id = t.id;

update public.users u set is_active = true
 where (u.full_name like '%اللهيبي%' and u.full_name ~ 'عبد ?الله')
    or (u.full_name like '%حديد%' and u.full_name like '%سالم%')
    or (u.full_name like '%الدعدي%' and u.full_name ~ 'عبد ?الواسع');

-- التحقق: يجب أن تظهر الثلاثة «يستطيع الدخول» و«مفعّل»، ومعهم أدوارهم (محضر مختبر العلوم 1 أو 2 أو 3)
select u.full_name as "الاسم", u.username as "اسم المستخدم", u.role as "النوع",
       case when a.banned_until > now() then 'موقوف' else 'يستطيع الدخول' end as "الدخول",
       case when u.is_active then 'مفعّل' else 'معطّل' end as "الحساب",
       (select string_agg(r.role_type::text, '، ') from public.admin_roles r where r.user_id = u.id) as "الأدوار"
  from public.users u join auth.users a on a.id = u.id
 where (u.full_name like '%اللهيبي%' and u.full_name ~ 'عبد ?الله')
    or (u.full_name like '%حديد%' and u.full_name like '%سالم%')
    or (u.full_name like '%الدعدي%' and u.full_name ~ 'عبد ?الواسع');
-- نهاية الجزء 1
