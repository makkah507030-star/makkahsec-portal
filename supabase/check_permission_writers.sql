-- =====================================================================
-- فحص للقراءة فقط (لا يغيّر شيئًا): من يكتب في جداول الاستئذان وملاحظات الغياب؟
-- يُرفع الاستئذان من ثلاثة مواضع: صفحة الاستئذان، ولوحة التحكم (الغائبون: هروب
-- أو استئذان ولي الأمر)، وخطوة الاستئذان في الأحداث (لمنظّم الحدث).
-- كل سطر: حساب كتب في آخر 90 يومًا، وأدواره، وهل يملك صلاحية «الاستئذان»، وأين كتب.
-- يُنفَّذ في Supabase ← SQL Editor.
-- =====================================================================
with w as (
  select pr.created_by as uid,
         case when exists (select 1 from public.event_participants ep where ep.permission_id = pr.id)
              then 'استئذان حدث' else 'استئذان' end as what
    from public.permission_requests pr where pr.created_at > now() - interval '90 days'
  union all
  select returned_by, 'عودة للفصل' from public.permission_returns
   where created_at > now() - interval '90 days' and returned_by is not null
  union all
  select created_by, 'ملاحظة غياب' from public.admin_missing_notes
   where created_at > now() - interval '90 days' and created_by is not null
),
per as (select uid, what, count(*) n from w group by 1, 2)
select coalesce(u.full_name, u.username) as "الحساب",
       u.role as "النوع",
       coalesce((select string_agg(ar.role_type::text, '، ') from public.admin_roles ar where ar.user_id = u.id), '—') as "أدواره",
       case when exists (select 1 from public.admin_roles ar where ar.user_id = u.id
                          and (ar.role_type::text in ('principal', 'tech_support')
                               or ar.role_type::text in (select role_type::text from public.role_permissions
                                                          where permission = 'permissions')))
            then 'نعم' else 'لا' end as "صلاحية الاستئذان",
       case when exists (select 1 from public.permission_grantors g where g.user_id = u.id and g.active)
            then 'نعم' else 'لا' end as "مخوّل استئذان",
       string_agg(per.what || ': ' || per.n, ' · ' order by per.what) as "ما كتبه"
  from per join public.users u on u.id = per.uid
 group by u.id, u.full_name, u.username, u.role
 order by 4, 1;
-- نهاية الجزء 1
