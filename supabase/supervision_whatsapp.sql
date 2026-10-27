-- =====================================================================
-- تذكير الإشراف اليومي عبر واتساب — الجزء 1 من 1.
-- المشرف المتابع يرى زر واتساب بجانب كل معلم مشرف معه في يومه (لوحة المناوبة والإشراف).
-- الدالة تعيد جوالات المعلمين المشرفين في يوم معيّن، ولا تعيد شيئًا إلا لمن هو
-- «مشرف متابع» في ذلك اليوم نفسه، فلا تكشف جوالات المعلمين لغيره.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.supervision_mobiles(p_dow int)
returns table (user_id uuid, mobile text)
language sql stable security definer set search_path = public as $$
  select sd.user_id, t.mobile
    from public.supervision_duty sd
    join public.teachers t on t.user_id = sd.user_id
   where sd.day_of_week = p_dow and sd.kind = 'teacher'
     and coalesce(t.mobile, '') <> ''
     and exists (select 1 from public.supervision_duty me
                  where me.user_id = auth.uid() and me.day_of_week = p_dow and me.kind = 'supervisor');
$$;

revoke execute on function public.supervision_mobiles(int) from public, anon;
grant execute on function public.supervision_mobiles(int) to authenticated, service_role;

-- التحقق: عدد المعلمين المشرفين الذين لهم جوال في كل يوم (يُفترض قريبًا من عددهم)
select sd.day_of_week as "اليوم",
       count(*) as "المعلمون المشرفون",
       count(*) filter (where coalesce(t.mobile, '') <> '') as "لهم جوال وحساب مرتبط"
  from public.supervision_duty sd
  left join public.teachers t on t.user_id = sd.user_id
 where sd.kind = 'teacher'
 group by 1 order by 1;
-- نهاية الجزء 1
