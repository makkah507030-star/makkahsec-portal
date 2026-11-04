-- =====================================================================
-- سجل الإشراف اليومي (2، 4 نوفمبر 2026): يوم فيه أكثر من مشرف متابع.
-- • ملاحظات لكل مشرف متابع باسمه (person_notes) يراها زميله ولا يعدّلها؛ يأخذ الخادم من كلٍّ نصيبه وحده.
-- • عند الاعتماد يُحفظ المشرفون المتابعون لذلك اليوم (followers) من جدول الإشراف، فيظهرون في التقرير،
--   ويُحسب اليوم لكل منهم في شواهد الأداء (e01_06)، لا لمن أنشأ السجل وحده.
-- يُنفَّذ بعد supervision_log.sql وduty_log_2.sql (يحل محل sup_perf_rows فيه). تكرار التنفيذ آمن.
-- =====================================================================
alter table public.supervision_log add column if not exists person_notes jsonb not null default '{}';
alter table public.supervision_log add column if not exists followers jsonb not null default '[]';   -- [{ user_id, name }]

create or replace function public.supervision_log_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare ed boolean := public.sup_editor(); me text := auth.uid()::text;
begin
  new.day_of_week := public.sup_dow(new.log_date);
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.supervisor_id := auth.uid();
    new.supervisor_name := (select full_name from users where id = auth.uid());
  elsif old.status = 'approved' and not ed then
    raise exception 'سجل الإشراف معتمد، فلا يُعدَّل';
  end if;
  if not ed then   -- المشرف المتابع: ملاحظاته وحدها من خانات الملاحظات الشخصية
    new.person_notes := case when tg_op = 'UPDATE' then coalesce(old.person_notes, '{}') - me else '{}' end
      || case when new.person_notes ? me then jsonb_build_object(me, new.person_notes -> me) else '{}' end;
  end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    new.approved_at := now(); new.approved_by := auth.uid();
    new.approved_by_name := (select full_name from users where id = auth.uid());
    new.followers := coalesce((select jsonb_agg(jsonb_build_object('user_id', sd.user_id, 'name', sd.person_name))
                                 from supervision_duty sd where sd.day_of_week = new.day_of_week and sd.kind = 'supervisor'), '[]');
  elsif new.status = 'draft' then
    new.approved_at := null; new.approved_by := null; new.approved_by_name := null;
  end if;
  return new;
end $$;

-- شواهد الأداء: كل مشرف متابع لليوم المعتمد (ومن أنشأ السجل للسجلات القديمة قبل هذا الملف)
create or replace function public.sup_perf_rows(p_uid uuid, y0 date)
returns table (uid uuid, item text, d date, detail text)
language sql stable security definer set search_path = public as $$
  select (m ->> 'user_id')::uuid, 'e01_06', l.log_date,
         'عضو في الإشراف اليومي · ' || case m ->> 'status' when 'late' then 'متأخر' else 'حاضر' end
    from supervision_log l cross join lateral jsonb_array_elements(l.members) m
   where l.status = 'approved' and l.log_date >= y0 and m ->> 'status' in ('present', 'late')
     and coalesce(m ->> 'user_id', '') <> '' and (p_uid is null or m ->> 'user_id' = p_uid::text)
  union all
  select f.u, 'e01_06', l.log_date, 'المشرف المتابع للإشراف اليومي'
    from supervision_log l cross join lateral (
      select (x ->> 'user_id')::uuid u from jsonb_array_elements(l.followers) x where coalesce(x ->> 'user_id', '') <> ''
      union select l.supervisor_id where jsonb_array_length(l.followers) = 0) f
   where l.status = 'approved' and l.log_date >= y0 and f.u is not null and (p_uid is null or f.u = p_uid)
  union all
  select (m ->> 'user_id')::uuid, 'e01_06', l.duty_date,
         'المناوبة اليومية · ' || case m ->> 'status' when 'late' then 'متأخر' else 'حاضر' end
    from duty_log l cross join lateral jsonb_array_elements(l.members) m
   where l.status = 'approved' and l.duty_date >= y0 and m ->> 'status' in ('present', 'late')
     and coalesce(m ->> 'user_id', '') <> '' and (p_uid is null or m ->> 'user_id' = p_uid::text)
  union all
  select ar.user_id, 'd06_06', l.log_date,
         'سجل إشراف معتمد · ' || coalesce(l.supervisor_name, '') || ' · غائب ' ||
         (select count(*) from jsonb_array_elements(l.members) x where x ->> 'status' = 'absent')
    from supervision_log l join admin_roles ar on ar.role_type::text in ('deputy_academic', 'deputy_school')
   where l.status = 'approved' and l.log_date >= y0 and (p_uid is null or ar.user_id = p_uid);
$$;
revoke all on function public.sup_perf_rows(uuid, date) from public, anon, authenticated;
-- نهاية الجزء 2
