-- فحص أدوار الأستاذ محمد شركار (قراءة فقط، لا يغيّر شيئًا).
-- المطلوب ليجمع بين «معلم» و«القائد الكشفي»:
--   حساب_إداري = admin  ·  مربوط_بسجل_معلم = نعم  ·  الأدوار_الإدارية فيها «القائد الكشفي»
select u.full_name as الاسم, u.username as اسم_الدخول, u.role::text as نوع_الحساب, u.is_active as نشط,
       (t.id is not null) as مربوط_بسجل_معلم, t.is_active as سجل_المعلم_نشط,
       (select string_agg(coalesce(c.label, r.role_type::text), '، ')
          from public.admin_roles r left join public.custom_roles c on c.role_type = r.role_type
         where r.user_id = u.id) as الأدوار_الإدارية
from public.users u
left join public.teachers t on t.user_id = u.id
where u.full_name like '%شركار%'
union all
-- سجل معلم باسمه غير مربوط بأي حساب (إن ظهر هنا فهو سبب المشكلة)
select t.full_name, null, 'سجل معلم بلا حساب', t.is_active, false, t.is_active, null
from public.teachers t
where t.full_name like '%شركار%' and t.user_id is null;
-- نهاية الجزء 1
