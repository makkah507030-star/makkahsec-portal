-- =====================================================================
-- طلب دعم فني واحد في اليوم لكل مستخدم (بتوقيت مكة):
-- • المسجّل: طلب واحد لحسابه في اليوم، ويتابعه أو يضيف إليه من صفحة الطلب.
-- • الزائر: طلب واحد لرقم جواله في اليوم (فوق حد الثلاثة في الساعة في submit_public_feedback).
-- • فريق الدعم الفني (صلاحية feedback) مستثنى.
-- يُفرض في قاعدة البيانات بمشغّل قبل الإدراج، فلا يُتجاوز من الصفحة. تكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.feedback_daily_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Asia/Riyadh')::date;
begin
  if auth.uid() is not null and exists (
       select 1 from admin_roles ar where ar.user_id = auth.uid()
          and ar.role_type in (select role_type from role_permissions where permission = 'feedback')) then
    return new;
  end if;
  if exists (
       select 1 from feedback f
        where (f.created_at at time zone 'Asia/Riyadh')::date = v_today
          and ((new.user_id is not null and f.user_id = new.user_id)
            or (new.user_id is null and f.user_id is null and f.contact = new.contact))) then
    raise exception 'لك طلب دعم فني اليوم: تابعه أو أضف إليه من صفحة الطلب، ويمكنك إرسال طلب جديد غدًا.';
  end if;
  return new;
end $$;

drop trigger if exists feedback_daily_limit on public.feedback;
create trigger feedback_daily_limit before insert on public.feedback
  for each row execute function public.feedback_daily_limit();

-- للتحقق
select exists (select 1 from pg_trigger where tgname = 'feedback_daily_limit') as "الحد اليومي مفعّل";

-- نهاية الجزء 1
