-- =====================================================================
-- موافقة الدعم الفني على الأخبار (4 نوفمبر 2026): كان كل حساب إداري ينشر مباشرة، والمعلم وحده مسودة.
-- الآن خبر أي حساب غير الدعم الفني والمدير يُحفظ مسودة «بانتظار الموافقة» ويصل الدعم الفني إشعار به،
-- وتعديله لخبر منشور يعيده للموافقة. ولا يعدّل غيرهما ولا يحذف إلا أخباره. الأخبار المنشورة سابقًا تبقى.
-- يُفرض في الخادم (مشغّل على جدول الأخبار) فلا يتجاوزه أي طلب مباشر. تكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.news_reviewer() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['principal', 'tech_support']);
$$;

create or replace function public.news_review_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare nid uuid;
begin
  if auth.uid() is null or public.news_reviewer() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    if old.created_by is distinct from auth.uid() then raise exception 'لا يُحذف إلا خبرك'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.created_by is distinct from auth.uid() then raise exception 'لا يُعدَّل إلا خبرك'; end if;
  if tg_op = 'INSERT' then new.created_by := auth.uid(); else new.created_by := old.created_by; end if;
  new.is_published := false;
  new.published_at := null;
  -- إشعار الدعم الفني بخبر جديد، أو بخبر منشور عُدّل فعاد للموافقة
  if tg_op = 'INSERT' or old.is_published then
    insert into notifications (title, body, kind, link, is_auto, created_by, sender_name)
    values ('خبر بانتظار الموافقة: ' || left(new.title, 80), 'راجعه في «الأخبار والمقالات» ثم انشره.', 'general', '/news-admin', true,
            auth.uid(), (select full_name from users where id = auth.uid()))
    returning id into nid;
    insert into notification_recipients (notification_id, user_id)
    select nid, ar.user_id from admin_roles ar join users u on u.id = ar.user_id
    where ar.role_type::text = 'tech_support' and u.is_active on conflict do nothing;
    begin perform public.push_notification(nid); exception when others then null; end;
  end if;
  return new;
end $$;

drop trigger if exists news_review_trg on public.news;
create trigger news_review_trg before insert or update or delete on public.news
  for each row execute function public.news_review_trg();
-- نهاية الجزء 1
