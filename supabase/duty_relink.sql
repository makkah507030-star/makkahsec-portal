-- =====================================================================
-- تصحيح ربط المناوبة والإشراف بالحسابات (4 نوفمبر 2026)
-- كانت صفحة إدارة المناوبة تربط الاسم المكتوب بأي حساب تأتي فيه كلماته متفرقة، فرُبط
-- «محمد سعيد الحازمي» بحساب «محمد بن حسن … الحازمي». المطابقة الصحيحة: أول الاسم يطابق أول اسم
-- الموظف بالترتيب (الاسم ثم الأب…) وآخره يطابق العائلة، في حساب واحد فقط.
-- يصحّح كل يوم مربوط بحساب لا يوافق اسمه: إلى الحساب الصحيح إن وُجد واحد، وإلا يُفك الربط
-- فيظهر «غير مربوط» ليختاره المدير. نتيجته: جدول بما تغيّر. تكرار التنفيذ آمن.
-- =====================================================================
create or replace function pg_temp.nn(s text) returns text[] language sql immutable as $$
  select coalesce(array_agg(w order by o), '{}') from unnest(regexp_split_to_array(
    translate(regexp_replace(coalesce(s, ''), '[ًٌٍَُِّْـ]', '', 'g'), 'أإآةى', 'اااهي'), '\s+'))
    with ordinality as t(w, o) where w <> '' and w not in ('بن', 'ابن') $$;

create or replace function pg_temp.fits(n text, f text) returns boolean language sql immutable as $$
  select case when cardinality(a) = 0 or cardinality(a) > cardinality(b) then false
    when a = b then true
    when cardinality(a) = 1 then false
    else a[cardinality(a)] = b[cardinality(b)] and a[1:cardinality(a) - 1] = b[1:cardinality(a) - 1] end
  from (select pg_temp.nn(n) a, pg_temp.nn(f) b) x $$;

-- الحساب الوحيد الموافق للاسم من الموظفين النشطين (لا طلاب ولا أولياء أمور)
create or replace function pg_temp.pick(n text) returns uuid language sql stable as $$
  select case when count(*) = 1 then (array_agg(id))[1] end from public.users
  where is_active and role::text not in ('student', 'guardian') and pg_temp.fits(n, full_name) $$;

drop table if exists pg_temp.duty_fix;
create temp table duty_fix as
  select 'المناوبة' as tbl, r.duty_date::text as day, r.name_a as name, u.full_name as was,
         pg_temp.pick(r.name_a) as new_id, r.id, 'a' as slot
  from public.duty_roster r join public.users u on u.id = r.user_a
  where r.name_a is not null and not pg_temp.fits(r.name_a, u.full_name)
  union all
  select 'المناوبة', r.duty_date::text, r.name_b, u.full_name, pg_temp.pick(r.name_b), r.id, 'b'
  from public.duty_roster r join public.users u on u.id = r.user_b
  where r.name_b is not null and not pg_temp.fits(r.name_b, u.full_name)
  union all
  select 'الإشراف', s.day_of_week::text, s.person_name, u.full_name, pg_temp.pick(s.person_name), s.id, 's'
  from public.supervision_duty s join public.users u on u.id = s.user_id
  where not pg_temp.fits(s.person_name, u.full_name);

update public.duty_roster r set user_a = f.new_id from duty_fix f where f.slot = 'a' and f.id = r.id;
update public.duty_roster r set user_b = f.new_id from duty_fix f where f.slot = 'b' and f.id = r.id;
update public.supervision_duty s set user_id = f.new_id from duty_fix f where f.slot = 's' and f.id = s.id;

select f.tbl as "الجدول", f.day as "اليوم", f.name as "الاسم المكتوب", f.was as "كان مربوطًا بـ",
       coalesce(u.full_name, 'غير مربوط (يختاره المدير)') as "صار مربوطًا بـ"
from duty_fix f left join public.users u on u.id = f.new_id order by 1, 2;
-- نهاية الجزء 1
