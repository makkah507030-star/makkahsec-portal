-- =====================================================================
-- سجل المناوبة اليومية (3 من 3، 4 نوفمبر 2026): ملاحظات لكل مناوب باسمه يراها زميله ولا يعدّلها، واسم من أضاف
-- كل متأخر وكل موقف، ولا يغيّر المناوب ولا يحذف إلا ما أضافه هو. فإن حفظ المناوبان معًا في الوقت نفسه بقي ما كتبه
-- كل منهما، لأن الخادم يأخذ من كل مناوب نصيبه وحده. الوكيل والإدارة كما كانوا. يُنفَّذ بعد duty_log_1..2. تكرار التنفيذ آمن.
-- =====================================================================
alter table public.duty_log add column if not exists person_notes jsonb not null default '{}';   -- { user_id: ملاحظاته }

-- المعتمدون: وكلاء الشؤون التعليمية والمدرسية وشؤون الطلاب، والمدير والدعم الفني
create or replace function public.duty_approver() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['principal', 'tech_support', 'deputy_academic', 'deputy_school', 'deputy_students']);
$$;

-- قائمة مدمجة: ما أضافه غير المستخدم من القديم، وما أضافه هو من الجديد
create or replace function public.duty_merge(p_old jsonb, p_new jsonb, p_uid text) returns jsonb
language sql immutable as $$
  select coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(p_old, '[]')) e where e ->> 'added_by' is distinct from p_uid), '[]')
      || coalesce((select jsonb_agg(e) from jsonb_array_elements(coalesce(p_new, '[]')) e where e ->> 'added_by' = p_uid), '[]');
$$;

create or replace function public.duty_log_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare ap boolean := public.duty_approver(); nm text := (select full_name from users where id = auth.uid()); me text := auth.uid()::text;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := auth.uid(); new.created_by_name := nm; end if;
  if tg_op = 'UPDATE' and old.status = 'approved' and not public.has_admin_role(array['principal', 'tech_support']) then
    raise exception 'سجل المناوبة معتمد، فلا يُعدَّل';
  end if;
  if not ap then
    if tg_op = 'UPDATE' and old.status <> 'draft' then raise exception 'رُفع السجل للوكيل، فلا يُعدَّل'; end if;
    if new.status = 'approved' then raise exception 'الاعتماد للوكيل'; end if;
    -- نصيب المناوب وحده: ملاحظاته، وما أضافه من متأخرين ومواقف
    new.person_notes := case when tg_op = 'UPDATE' then coalesce(old.person_notes, '{}') - me else '{}' end
      || case when new.person_notes ? me then jsonb_build_object(me, new.person_notes -> me) else '{}' end;
    new.lates := public.duty_merge(case when tg_op = 'UPDATE' then old.lates end, new.lates, me);
    new.incidents := public.duty_merge(case when tg_op = 'UPDATE' then old.incidents end, new.incidents, me);
    new.deputy_note := case when tg_op = 'UPDATE' then old.deputy_note end;
    if tg_op = 'UPDATE' then new.members := old.members; new.duty_note := old.duty_note; end if;
  end if;
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status = 'draft') then new.submitted_at := now(); end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    new.approved_at := now(); new.approved_by := auth.uid(); new.approved_by_name := nm;
    if new.notified_at is null and jsonb_array_length(new.lates) > 0 then
      begin perform public.duty_notify_lates(new.duty_date, new.lates); new.notified_at := now();
      exception when undefined_function then null; end;
    end if;
  elsif new.status <> 'approved' then
    new.approved_at := null; new.approved_by := null; new.approved_by_name := null;
  end if;
  return new;
end $$;
-- نهاية الجزء 3
