-- =====================================================================
-- قسم التقويم والاعتماد المدرسي (4): تذكير مشرفي المجالات بالشواهد المطلوبة في خطة التحسين
-- السارية ولم تُرفع بعد. يرسله مشرف اللجنة أو المدير من «مساعد الشواهد»، فيصل كل مشرف مجال
-- إشعار (وعلى الجوال لمن فعّله) بعدد ما بقي في مجالاته. يُنفَّذ بعد acc_3.sql، وتكرار التنفيذ آمن.
-- الشاهد يُعدّ مرفوعًا إن رُفع للمؤشر شاهد بعنوانه نفسه (كما في src/lib/accreditation.js).
-- =====================================================================

-- الشواهد المطلوبة غير المرفوعة في مجالات معيّنة من الخطة السارية
create or replace function public.acc_missing(p_domains int[])
returns table (code text, title text) language sql stable security definer set search_path = public as $$
  select g.code, t.title
    from acc_programs g
    join acc_plans p on p.id = g.plan_id and p.status = 'active'
    cross join lateral unnest(g.evidence) as t(title)
   where g.kind = 'plan' and g.domain = any(p_domains)
     and not exists (select 1 from acc_evidence e where e.code = g.code and trim(e.title) = trim(t.title));
$$;

-- تذكير كل مشرف مجال بما بقي في مجالاته؛ يعيد عدد من وصلهم التذكير
create or replace function public.acc_remind() returns int
language plpgsql security definer set search_path = public as $$
declare m record; n int; v_sent int := 0; nid uuid;
begin
  if not public.acc_coord() then raise exception 'التذكير لمشرف اللجنة ومدير المدرسة'; end if;
  for m in select user_id, domains from acc_members where role = 'member' and cardinality(domains) > 0 loop
    select count(*) into n from public.acc_missing(m.domains);
    if n > 0 then
      nid := public.send_notification('تذكير: شواهد خطة التحسين',
        'بقي ' || n || ' من الشواهد المطلوبة في مجالاتك لم تُرفع بعد. افتح «مساعد الشواهد» لرفعها.',
        'general', '/accreditation?tab=ind', null, array[m.user_id], null, null, true);
      begin perform public.push_notification(nid); exception when others then null; end;
      v_sent := v_sent + 1;
    end if;
  end loop;
  return v_sent;
end $$;

revoke all on function public.acc_missing(int[]), public.acc_remind() from public, anon;
grant execute on function public.acc_remind() to authenticated;

-- نهاية الجزء 4
