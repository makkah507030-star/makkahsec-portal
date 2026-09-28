-- =====================================================================
-- الدعم الفني مفتوح للجميع: من لا يستطيع الدخول (طالب، ولي أمر، معلم)
-- يرسل طلبه باسمه ورقم جواله، ويتواصل معه الدعم الفني هاتفيًا.
--
--   • submit_public_feedback: دالة آمنة للزائر غير المسجّل (anon) — تتحقق من
--     الاسم والجوال والنص، وتحدّ من التكرار (3 طلبات في الساعة لكل جوال،
--     و30 طلبًا في الساعة إجمالًا من الزوار)، ثم تُدرج الطلب وتنبّه الدعم الفني.
--   • نوع طلب جديد: «مشكلة في الدخول» (login).
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- =====================================================================

-- نوع الطلب: يُزال أي قيد سابق على category ويُضاف قيد يشمل «login»
-- (NOT VALID: لا يُعاد فحص الطلبات السابقة)
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.feedback'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table public.feedback drop constraint %I', r.conname);
  end loop;
  alter table public.feedback
    add constraint feedback_category_check
    check (category in ('login', 'bug', 'suggestion', 'data', 'other')) not valid;
end $$;

create or replace function public.submit_public_feedback(
  p_name     text,
  p_mobile   text,
  p_role     text,
  p_category text,
  p_message  text,
  p_page     text default null
) returns public.feedback.id%type
language plpgsql security definer set search_path = public as $$
declare
  v_mobile text := regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g');
  v_id     public.feedback.id%type;
begin
  -- الجوال السعودي: 05XXXXXXXX أو 9665XXXXXXXX ← يُحفظ بصيغة 05XXXXXXXX
  if v_mobile ~ '^9665\d{8}$' then v_mobile := '0' || substr(v_mobile, 4); end if;
  if v_mobile !~ '^05\d{8}$' then raise exception 'رقم الجوال غير صحيح — اكتبه بصيغة 05XXXXXXXX'; end if;
  if length(trim(coalesce(p_name, ''))) < 3 then raise exception 'اكتب الاسم'; end if;
  if length(trim(coalesce(p_message, ''))) < 10 then raise exception 'اكتب وصفًا أوضح للطلب'; end if;

  -- الحد من التكرار
  if (select count(*) from public.feedback
      where contact = v_mobile and user_id is null and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'وصلنا طلبك، وسيتواصل معك الدعم الفني قريبًا — لا حاجة لتكراره';
  end if;
  if (select count(*) from public.feedback
      where user_id is null and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'الطلبات كثيرة الآن — حاول بعد قليل';
  end if;

  insert into public.feedback (name, contact, role_label, category, message, page_url, user_id)
  values (left(trim(p_name), 80), v_mobile, left(coalesce(nullif(trim(p_role), ''), 'زائر'), 30),
          case when p_category in ('login', 'bug', 'suggestion', 'data', 'other') then p_category else 'other' end,
          left(trim(p_message), 2000), left(p_page, 300), null)
  returning id into v_id;

  -- تنبيه فريق الدعم — لا يُفشل الطلب إن تعذّر
  begin
    perform public.notify_ticket_support(
      p_feedback_id => v_id,
      p_title       => 'طلب دعم من خارج البوابة',
      p_body        => left(trim(p_name) || ': ' || trim(p_message), 140),
      p_link        => '/ticket/' || v_id);
  exception when others then null;
  end;

  return v_id;
end;
$$;

revoke execute on function public.submit_public_feedback from public;
grant  execute on function public.submit_public_feedback to anon, authenticated;
