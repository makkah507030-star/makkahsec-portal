-- الشواهد الآلية (الجزء 2 من 2): يُنفَّذ بعد الجزء 1. تكرار التنفيذ آمن.
-- • perf_auto_counts: بالاسم والصلاحية نفسيهما (المعلم لنفسه، والمدير والدعم الفني للجميع)،
--   والحساب من perf_auto_counts_core؛ فلا يتغيّر شيء في صفحات الأداء الوظيفي.
-- • dfile_auto_evidence: عدد الشواهد الآلية لكل عنصر (e03…) في ملف المعلم الرقمي،
--   يستدعيها dfile_data (الجزء 3) وdfile_public (الجزء 5) إن وُجدت، فيراها الزائر دون دخول.

create or replace function public.perf_auto_counts(p_uid uuid, p_year text)
returns table (teacher_user_id uuid, item_key text, cnt bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role(array['principal', 'tech_support'])
     and (p_uid is null or p_uid is distinct from auth.uid()) then
    raise exception 'غير مصرّح';
  end if;
  return query select * from public.perf_auto_counts_core(p_uid, p_year);
end;
$$;
revoke execute on function public.perf_auto_counts(uuid, text) from public, anon;
grant  execute on function public.perf_auto_counts(uuid, text) to authenticated;

create or replace function public.dfile_auto_evidence(p_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
    select left(c.item_key, 3) k, sum(c.cnt) n
      from public.perf_auto_counts_core(p_uid, (select value from public.settings where key = 'active_year')) c
     group by 1) x;
$$;
revoke execute on function public.dfile_auto_evidence(uuid) from public, anon, authenticated;
-- نهاية الجزء 2
