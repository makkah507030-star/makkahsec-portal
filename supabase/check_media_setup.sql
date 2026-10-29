-- =====================================================================
-- فحص للقراءة فقط: هل اكتمل تشغيل ملفات الإعلام الستة
-- (media_1 ← media_2 ← nominations_7 ← media_3 ← media_4 ← media_5).
-- كل سطر «✓» يعني أن الملف أنشأ ما عليه، و«✗» يعني إعادة تشغيله.
-- لا يغيّر شيئًا في القاعدة.
-- =====================================================================
select 'media_1' as "الملف", 'المعرض والمخزن الخاص' as "المحتوى",
       case when to_regclass('public.media_items') is not null
             and exists (select 1 from storage.buckets where id = 'media-library' and not public)
             and exists (select 1 from public.role_permissions where role_type = 'media_portal' and permission = 'media')
             and exists (select 1 from information_schema.columns where table_name = 'media_items' and column_name = 'tracked')
            then '✓' else '✗' end as "الحالة"
union all
select 'media_2', 'موافقة التصوير و«لا يُصوَّر»',
       case when to_regclass('public.media_consents') is not null and to_regprocedure('public.media_no_photo()') is not null
             and to_regprocedure('public.media_consent_set(uuid, boolean)') is not null then '✓' else '✗' end
union all
select 'nominations_7', 'ترشّح المعلمين للقيادة',
       case when to_regclass('public.nom_staff_apps') is not null
             and exists (select 1 from information_schema.columns where table_name = 'nom_calls' and column_name = 'staff_lead')
             and to_regprocedure('public.nom_staff_apply(uuid, text)') is not null then '✓' else '✗' end
union all
select 'media_3', 'الفريق الإعلامي',
       case when to_regclass('public.media_team') is not null
             and exists (select 1 from information_schema.columns where table_name = 'nom_calls' and column_name = 'link_media')
             and exists (select 1 from pg_trigger where tgname = 'media_team_from_nom') then '✓' else '✗' end
union all
select 'media_4', 'البطاقة الإعلامية والوسم',
       case when to_regclass('public.media_team_staff') is not null and to_regprocedure('public.media_card_me()') is not null
             and exists (select 1 from pg_trigger where tgname = 'media_staff_from_nom') then '✓' else '✗' end
union all
select 'media_5', 'التواصل مع المركز',
       case when to_regclass('public.media_requests') is not null and to_regclass('public.media_request_msgs') is not null
             and exists (select 1 from pg_trigger where tgname = 'media_request_notify') then '✓' else '✗' end
union all
select 'الدور', 'من يحمل دور «البوابة الإعلامية»',
       coalesce((select string_agg(u.full_name, '، ') from public.admin_roles a join public.users u on u.id = a.user_id
                  where a.role_type::text = 'media_portal' and u.is_active), 'لم يُسند بعد');
-- نهاية الجزء 1
