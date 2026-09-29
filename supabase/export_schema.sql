-- =====================================================================
--  تصدير بنية قاعدة البيانات — للقراءة فقط (لا يعدّل شيئًا ولا يقرأ بيانات)
--
--  الاستخدام: Supabase ← SQL Editor ← الصق هذا الملف ← Run
--  ثم من النتيجة: Export ← Download CSV، وأرسل الملف ليُحفظ في المستودع
--  (supabase/schema/). أعد تشغيله بعد أي تعديل في البنية.
--
--  يُخرج صفًّا لكل عنصر مرتّبًا بترتيب إعادة الإنشاء (عمود ord):
--  الأنواع (enum) والتسلسلات، الجداول وأعمدتها، الدوال، القيود والمفاتيح،
--  الفهارس، العروض (views)، تفعيل RLS وسياساته، والمشغّلات (triggers) —
--  لمخطط public، وسياسات التخزين (storage.objects).
--  الدوال قبل العروض والقيود لأن بعضها يستدعيها؛ ولذلك يبدأ الناتج بإيقاف
--  فحص أجسام الدوال عند الإنشاء (كما يفعل pg_dump).
-- =====================================================================

with
tbl as (
  select c.oid, c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
),

-- إيقاف فحص أجسام الدوال: دوال تستدعي دوالًا أو عروضًا تُنشأ بعدها
setting as (
  select -1 as ord, 'setting' as kind, 'check_function_bodies' as name,
    'set check_function_bodies = off;' as ddl
),

-- ٠) الأنواع المخصّصة (enum) — تحتاجها أعمدة الجداول
enums as (
  select 0 as ord, 'type' as kind, t.typname as name,
    format('create type public.%I as enum (%s);', t.typname,
      string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder)) as ddl
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  join pg_enum e on e.enumtypid = t.oid
  where n.nspname = 'public'
  group by t.typname
),

-- ٠) التسلسلات (الأعمدة ذات الترقيم التلقائي تحتاجها قبل الجداول)
sequences as (
  select 0 as ord, 'sequence' as kind, s.sequencename as name,
    format('create sequence if not exists public.%I;', s.sequencename) as ddl
  from pg_sequences s where s.schemaname = 'public'
),

-- ١) الجداول بأعمدتها
tables as (
  select 1 as ord, 'table' as kind, t.relname as name,
    format(E'create table if not exists public.%I (\n%s\n);', t.relname,
      string_agg(
        format('  %I %s%s%s', a.attname,
          format_type(a.atttypid, a.atttypmod),
          case when a.attnotnull then ' not null' else '' end,
          case when d.adbin is not null then ' default ' || pg_get_expr(d.adbin, d.adrelid) else '' end),
        E',\n' order by a.attnum)) as ddl
  from tbl t
  join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  group by t.relname
),

-- ٣) القيود: المفاتيح الأساسية والفريدة والخارجية والتحقق
constraints as (
  select case when con.contype in ('p', 'u', 'x') then 3 else 4 end,
    'constraint', t.relname || '.' || con.conname,
    format('alter table public.%I add constraint %I %s;', t.relname, con.conname, pg_get_constraintdef(con.oid))
  from pg_constraint con join tbl t on t.oid = con.conrelid
),

-- ٥) الفهارس غير الناتجة عن قيود (بعد القيود)
indexes as (
  select 5, 'index', i.indexname, i.indexdef || ';'
  from pg_indexes i
  where i.schemaname = 'public'
    and not exists (select 1 from pg_constraint c where c.conname = i.indexname)
),

-- ٧) تفعيل RLS
rls as (
  select 7, 'rls', c.relname,
    format('alter table public.%I enable row level security;', c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
),

-- ٨) سياسات الصلاحيات (public + storage)
policies as (
  select 8, 'policy', p.schemaname || '.' || p.tablename || ': ' || p.policyname,
    format('create policy %I on %I.%I as %s for %s to %s%s%s;',
      p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd,
      array_to_string(p.roles, ', '),
      case when p.qual is not null then E'\n  using (' || p.qual || ')' else '' end,
      case when p.with_check is not null then E'\n  with check (' || p.with_check || ')' else '' end)
  from pg_policies p
  where p.schemaname in ('public', 'storage')
),

-- ٢) الدوال (عدا ما تملكه الإضافات) — بعد الجداول لأن بعض معاملاتها أنواع جداول
functions as (
  select 2, 'function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    pg_get_functiondef(p.oid) || ';'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
),

-- ٩) المشغّلات
triggers as (
  select 9, 'trigger', c.relname || '.' || tg.tgname, pg_get_triggerdef(tg.oid) || ';'
  from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not tg.tgisinternal
),

-- ٦) العروض — بعد الدوال لأن بعضها يستدعيها
views as (
  select 6, 'view', v.viewname,
    format(E'create or replace view public.%I as\n%s', v.viewname, v.definition)
  from pg_views v where v.schemaname = 'public'
)

select * from setting
union all select * from enums
union all select * from sequences
union all select * from tables
union all select * from constraints
union all select * from indexes
union all select * from rls
union all select * from policies
union all select * from functions
union all select * from triggers
union all select * from views
order by 1, 3;
