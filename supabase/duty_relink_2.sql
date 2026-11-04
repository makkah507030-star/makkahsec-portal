-- =====================================================================
-- تصحيح ربط المناوبة والإشراف، الجزء الثاني (4 نوفمبر 2026): يكمل duty_relink.sql
-- قاعدته الصارمة فكّت أيامًا صحيحة: «نعيم حامد الأحمدي» (بعد العائلة القبيلة)، و«عاطف مسعود المولد»
-- (الجد لا الأب)، و«جار الله» و«أبو بكر» بمسافة. المطابقة الآن على درجات، وفي كل درجة حساب واحد فقط:
-- تام ← بالترتيب (الاسم ثم الأب… والعائلة) ← الاسم الأول نفسه وبقية الكلمات بترتيبها.
-- يربط غير المربوط، ويصحّح المربوط الذي لا يوافق. نتيجته: جدول بما تغيّر. تكرار التنفيذ آمن.
-- =====================================================================
create or replace function pg_temp.nn(s text) returns text[] language sql immutable as $$
  select coalesce(array_agg(w order by o), '{}') from unnest(regexp_split_to_array(
    regexp_replace(regexp_replace(array_to_string(array(select x from unnest(regexp_split_to_array(
      translate(regexp_replace(coalesce(s, ''), '[ًٌٍَُِّْـ]', '', 'g'), 'أإآةى', 'اااهي'), '\s+')) x
      where x <> '' and x not in ('بن', 'ابن')), ' '),
    '(^| )(ابو|عبد) ', '\1\2', 'g'), ' (الله|الدين|الرحمن)( |$)', '\1\2', 'g'), ' '))
    with ordinality as t(w, o) where w <> '' $$;

create or replace function pg_temp.strict_fit(a text[], b text[]) returns boolean language sql immutable as $$
  select cardinality(a) >= 2 and cardinality(a) <= cardinality(b) and a[cardinality(a)] = b[cardinality(b)]
     and a[1:cardinality(a) - 1] = b[1:cardinality(a) - 1] $$;

create or replace function pg_temp.loose_fit(a text[], b text[]) returns boolean language plpgsql immutable as $$
declare i int := 2; x text;
begin
  if cardinality(a) < 2 or a[1] is distinct from b[1] then return false; end if;
  foreach x in array b[2:cardinality(b)] loop if i <= cardinality(a) and x = a[i] then i := i + 1; end if; end loop;
  return i > cardinality(a);
end $$;

-- الحساب الوحيد الموافق في أول درجة فيها موافق (null إن لم يوافق أحد أو وافق أكثر من حساب)
create or replace function pg_temp.pick(n text) returns uuid language plpgsql stable as $$
declare a text[] := pg_temp.nn(n); ids uuid[];
begin
  if cardinality(a) = 0 then return null; end if;
  select array_agg(id) into ids from public.users where is_active and role::text not in ('student', 'guardian') and pg_temp.nn(full_name) = a;
  if ids is null then
    select array_agg(id) into ids from public.users where is_active and role::text not in ('student', 'guardian') and pg_temp.strict_fit(a, pg_temp.nn(full_name));
  end if;
  if ids is null then
    select array_agg(id) into ids from public.users where is_active and role::text not in ('student', 'guardian') and pg_temp.loose_fit(a, pg_temp.nn(full_name));
  end if;
  return case when cardinality(ids) = 1 then ids[1] end;
end $$;

drop table if exists pg_temp.duty_src;
create temp table duty_src as
  select 'المناوبة' tbl, duty_date::text dy, name_a nm, user_a cur, pg_temp.pick(name_a) new_id, id, 'a' slot from public.duty_roster where name_a is not null
  union all select 'المناوبة', duty_date::text, name_b, user_b, pg_temp.pick(name_b), id, 'b' from public.duty_roster where name_b is not null
  union all select 'الإشراف', day_of_week::text, person_name, user_id, pg_temp.pick(person_name), id, 's' from public.supervision_duty;

-- يبقى الربط الحالي إن وافق الاسم ولم يوجد حساب آخر أدق منه
drop table if exists pg_temp.duty_fix;
create temp table duty_fix as
  select s.* from duty_src s left join public.users u on u.id = s.cur
  where s.new_id is distinct from s.cur
    and (s.cur is null and s.new_id is not null
      or s.cur is not null and u.id is not null and not (pg_temp.loose_fit(pg_temp.nn(s.nm), pg_temp.nn(u.full_name)) and s.new_id is null));

update public.duty_roster r set user_a = f.new_id from duty_fix f where f.slot = 'a' and f.id = r.id;
update public.duty_roster r set user_b = f.new_id from duty_fix f where f.slot = 'b' and f.id = r.id;
update public.supervision_duty s set user_id = f.new_id from duty_fix f where f.slot = 's' and f.id = s.id;

select f.tbl "الجدول", f.dy "اليوم", f.nm "الاسم المكتوب", coalesce(o.full_name, 'غير مربوط') "كان",
       coalesce(u.full_name, 'غير مربوط (يختاره المدير)') "صار"
from duty_fix f left join public.users o on o.id = f.cur left join public.users u on u.id = f.new_id order by 1, 2;
-- نهاية الجزء 1
