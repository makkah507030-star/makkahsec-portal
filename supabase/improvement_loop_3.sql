-- حلقة التحسين (الجزء 3 من 5): المحفّزان — زيارة الدعم وتقييم الأداء حين يصدران للمعلم.
-- • زيارة الدعم: عند صدورها (لا مسودة ولا بانتظار اعتماد ولا معادة)، درجات البنود من rb_perf
--   (العنصر 1 هو e01 … العنصر 11 هو e11)، والتوصيات المؤكدة من data.improve.
-- • تقييم الأداء: عند إرساله للمعلم، الدرجات من ratings والتوصيات المؤكدة من improve.
-- • أي خطأ هنا لا يمنع إصدار الاستمارة ولا إرسال التقييم: يُسجَّل تحذيرًا فقط.
-- يُنفَّذ بعد الجزأين 1 و2. تكرار التنفيذ آمن.

create or replace function public.improve_from_visit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sc jsonb := '{}'::jsonb;
  v text;
  i int;
begin
  if new.recipient_user_id is null or new.status in ('draft', 'pending', 'rejected')
     or (tg_op = 'UPDATE' and old.status not in ('draft', 'pending', 'rejected')) then
    return new;
  end if;
  if not exists (select 1 from public.form_templates where id = new.template_id and key = 'teacher_support_visit') then
    return new;
  end if;
  begin
    for i in 0..10 loop
      v := new.data->'rb_perf'->(i::text)->>'score';
      if v ~ '^[1-5]$' then
        sc := sc || jsonb_build_object('e' || lpad((i + 1)::text, 2, '0'), v::int);
      end if;
    end loop;
    perform public.improve_apply(new.recipient_user_id, new.created_by, 'visit', new.id, sc,
                                 coalesce(new.data->'improve', '[]'::jsonb));
  exception when others then
    raise warning 'improve_from_visit: %', sqlerrm;
  end;
  return new;
end; $$;

drop trigger if exists improve_from_visit on public.form_documents;
create trigger improve_from_visit after insert or update of status on public.form_documents
  for each row execute function public.improve_from_visit();

create or replace function public.improve_from_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sent_at is null or (tg_op = 'UPDATE' and old.sent_at is not null) then
    return new;
  end if;
  begin
    perform public.improve_apply(new.teacher_user_id, new.created_by, 'review', new.id,
      (select coalesce(jsonb_object_agg(k, v::int), '{}'::jsonb)
         from jsonb_each_text(coalesce(new.ratings, '{}'::jsonb)) as t(k, v) where v ~ '^[1-5]$'),
      coalesce(new.improve, '[]'::jsonb));
  exception when others then
    raise warning 'improve_from_review: %', sqlerrm;
  end;
  return new;
end; $$;

drop trigger if exists improve_from_review on public.perf_reviews;
create trigger improve_from_review after insert or update of sent_at on public.perf_reviews
  for each row execute function public.improve_from_review();

revoke execute on function public.improve_from_visit() from public, anon, authenticated;
revoke execute on function public.improve_from_review() from public, anon, authenticated;
-- نهاية الجزء 3
