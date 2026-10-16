-- حلقة التحسين (الجزء 4 من 5): إجراءات الطرفين على التوصية — دالة واحدة بحسب p_action:
-- • المعلم: plan (يرسل خطته: الإجراءات والدعم المطلوب وموعد المتابعة)، progress (يكتب ما نفّذه).
-- • المتابع (الزائر) أو المدير: approve (يعتمد الخطة، وله تعديل الموعد)، return (يعيدها بملاحظة)،
--   reschedule (يغيّر موعد المتابعة)، cancel (يلغي التوصية بسبب).
-- القياس آلي من الزيارة أو التقييم التالي (الجزء 2)، فلا إجراء لإغلاقها يدويًا.
-- يُنفَّذ بعد الجزء 1. تكرار التنفيذ آمن.

create or replace function public.improve_act(p_id uuid, p_action text, p_note text default null,
                                              p_support text default null, p_date date default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  g public.improvement_goals;
  me uuid := auth.uid();
  boss boolean := public.has_admin_role(array['principal']);
  note text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into g from public.improvement_goals where id = p_id for update;
  if not found then raise exception 'التوصية غير موجودة'; end if;

  if p_action in ('plan', 'progress') then
    if g.teacher_user_id is distinct from me then raise exception 'الخطة يكتبها المعلم صاحب التوصية'; end if;
    if p_action = 'plan' then
      if g.status <> 'plan' then raise exception 'أُرسلت الخطة من قبل'; end if;
      if note is null then raise exception 'اكتب إجراءات الخطة'; end if;
      if p_date is null or p_date < current_date then raise exception 'اختر موعد متابعة من اليوم فصاعدًا'; end if;
      update public.improvement_goals
         set plan_actions = left(note, 3000), plan_support = left(nullif(trim(coalesce(p_support, '')), ''), 2000),
             follow_up_date = p_date, plan_sent_at = now(), status = 'review', updated_at = now()
       where id = p_id;
    else
      if g.status <> 'active' then raise exception 'لا خطة جارية لهذه التوصية'; end if;
      update public.improvement_goals set progress_note = left(note, 2000), progress_at = now(), updated_at = now()
       where id = p_id;
    end if;
    return;
  end if;

  if g.owner_user_id is distinct from me and not boss then
    raise exception 'المتابعة لصاحب الزيارة أو لمدير المدرسة';
  end if;
  if p_action = 'approve' then
    if g.status <> 'review' then raise exception 'لا خطة تنتظر الاعتماد'; end if;
    update public.improvement_goals
       set status = 'active', plan_approved_at = now(), plan_return_note = null,
           follow_up_date = coalesce(p_date, follow_up_date), updated_at = now()
     where id = p_id;
  elsif p_action = 'return' then
    if g.status <> 'review' then raise exception 'لا خطة تنتظر الاعتماد'; end if;
    if note is null then raise exception 'اكتب ملاحظتك للمعلم'; end if;
    update public.improvement_goals set status = 'plan', plan_return_note = left(note, 1000), updated_at = now()
     where id = p_id;
  elsif p_action = 'reschedule' then
    if g.status <> 'active' then raise exception 'لا خطة جارية لهذه التوصية'; end if;
    if p_date is null or p_date < current_date then raise exception 'اختر موعدًا من اليوم فصاعدًا'; end if;
    update public.improvement_goals set follow_up_date = p_date, updated_at = now() where id = p_id;
  elsif p_action = 'cancel' then
    if g.status not in ('plan', 'review', 'active') then raise exception 'التوصية مغلقة'; end if;
    if note is null then raise exception 'اكتب سبب الإلغاء'; end if;
    update public.improvement_goals set status = 'cancelled', cancel_note = left(note, 1000),
           closed_at = now(), updated_at = now() where id = p_id;
  else
    raise exception 'إجراء غير معروف';
  end if;
end; $$;

revoke execute on function public.improve_act(uuid, text, text, text, date) from public, anon;
grant  execute on function public.improve_act(uuid, text, text, text, date) to authenticated;
-- نهاية الجزء 4
