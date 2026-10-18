-- الأدوار المخصّصة (1 من 2): عشر خانات أدوار إضافية في قائمة الأدوار الإدارية.
-- يُسمّى كل دور من صفحة «الإدارة» (مثل: القائد الكشفي)، ويُسند لشخص من داخل المدرسة أو خارجها.
-- يُشغَّل هذا الجزء وحده أولًا، ثم الجزء 2.
alter type public.admin_role_type add value if not exists 'custom_1';
alter type public.admin_role_type add value if not exists 'custom_2';
alter type public.admin_role_type add value if not exists 'custom_3';
alter type public.admin_role_type add value if not exists 'custom_4';
alter type public.admin_role_type add value if not exists 'custom_5';
alter type public.admin_role_type add value if not exists 'custom_6';
alter type public.admin_role_type add value if not exists 'custom_7';
alter type public.admin_role_type add value if not exists 'custom_8';
alter type public.admin_role_type add value if not exists 'custom_9';
alter type public.admin_role_type add value if not exists 'custom_10';
-- نهاية الجزء 1
